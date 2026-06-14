import { httpError } from '../../shared/http.js';
import { parseAmount, round } from '../../shared/money.js';
import { localDateKey } from '../../shared/dates.js';
import { normalizeCurrency, normalizeDateOnly, normalizeKey, title } from '../../shared/normalizers.js';
import { getChatId } from '../../shared/request.js';
import { getAppSetting, timeoutSignal } from '../../shared/settings-store.js';
import { hmacSha256Hex } from '../../shared/crypto.js';

const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'SOL', 'USDT'];
const CACHE_MINUTES = 5;

const ASSET_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  POL: 'polygon-ecosystem-token',
  TON: 'the-open-network',
  TRX: 'tron',
  LTC: 'litecoin',
};

export async function cryptoPortfolio(env, params, options = {}) {
  const chatId = getChatId(env, params);
  const exchangeRate = Number(options.exchangeRate || params.get('exchange_rate') || 3.85) || 3.85;
  const requestedSymbols = parseSymbols(params.get('symbols'));
  const refresh = options.refresh ?? params.get('refresh') === '1';

  const [operations, alerts] = await Promise.all([
    cryptoOperationsList(env, chatId),
    cryptoAlertsList(env, chatId),
  ]);

  const symbols = uniqueSymbols([
    ...DEFAULT_SYMBOLS,
    ...requestedSymbols,
    ...operations.map((item) => item.symbol),
    ...alerts.map((item) => item.symbol),
  ]);
  const prices = await cryptoPrices(env, symbols, { refresh });
  const priceMap = Object.fromEntries(prices.map((item) => [item.symbol, item]));
  const positions = buildPositions(operations, priceMap, exchangeRate);
  const binance = await binanceAccountSnapshot(env, symbols, priceMap, exchangeRate);
  const summary = buildSummary(positions, exchangeRate, binance);
  const enrichedAlerts = alerts.map((alert) => alertShape(alert, priceMap[alert.symbol]));

  return {
    ok: true,
    exchangeRate,
    cacheMinutes: await cryptoCacheMinutes(env),
    prices,
    positions,
    operations: operations.map(operationShape),
    alerts: enrichedAlerts,
    binance,
    summary,
    suggestions: cryptoSuggestions({ summary, positions, alerts: enrichedAlerts }),
    updatedAt: new Date().toISOString(),
  };
}

export async function createCryptoOperation(env, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const operation = normalizeOperation(payload, chatId);
  await env.DB.prepare(`
    INSERT INTO crypto_operations (
      id, chat_id, symbol, asset_name, type, quantity, unit_price_usd, total_amount,
      currency, operation_date, notes, active, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  `).bind(
    operation.id,
    operation.chat_id,
    operation.symbol,
    operation.asset_name,
    operation.type,
    operation.quantity,
    operation.unit_price_usd,
    operation.total_amount,
    operation.currency,
    operation.operation_date,
    operation.notes,
  ).run();

  return {
    ok: true,
    operation: operationShape(operation),
  };
}

export async function deleteCryptoOperation(env, id, params) {
  const chatId = getChatId(env, params);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw httpError(400, 'id requerido');

  await env.DB.prepare(`
    UPDATE crypto_operations
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(cleanId, chatId).run();

  return { ok: true, deleted: true, id: cleanId };
}

export async function createCryptoAlert(env, payload, params) {
  const chatId = String(params.get('chat_id') || payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  if (!chatId) throw httpError(400, 'chat_id requerido');

  const alert = normalizeAlert(payload, chatId);
  await env.DB.prepare(`
    INSERT INTO crypto_alerts (
      id, chat_id, symbol, condition, target_price_usd, active, notes, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      condition = excluded.condition,
      target_price_usd = excluded.target_price_usd,
      active = 1,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    alert.id,
    alert.chat_id,
    alert.symbol,
    alert.condition,
    alert.target_price_usd,
    alert.notes,
  ).run();

  return { ok: true, alert: alertShape(alert) };
}

export async function deleteCryptoAlert(env, id, params) {
  const chatId = getChatId(env, params);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw httpError(400, 'id requerido');

  await env.DB.prepare(`
    UPDATE crypto_alerts
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(cleanId, chatId).run();

  return { ok: true, deleted: true, id: cleanId };
}

async function cryptoOperationsList(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT id, chat_id, symbol, asset_name, type, quantity, unit_price_usd, total_amount,
           currency, operation_date, notes, created_at, updated_at
    FROM crypto_operations
    WHERE chat_id = ? AND active = 1
    ORDER BY operation_date ASC, created_at ASC
  `).bind(chatId).all();

  return rows.results || [];
}

async function cryptoAlertsList(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT id, chat_id, symbol, condition, target_price_usd, active, last_triggered_at,
           notes, created_at, updated_at
    FROM crypto_alerts
    WHERE chat_id = ? AND active = 1
    ORDER BY symbol ASC, target_price_usd ASC
  `).bind(chatId).all();

  return rows.results || [];
}

async function cryptoPrices(env, symbols, { refresh = false } = {}) {
  const cleanSymbols = uniqueSymbols(symbols);
  if (!cleanSymbols.length) return [];

  const cacheMinutes = await cryptoCacheMinutes(env);
  const cached = await cachedPrices(env, cleanSymbols);
  const cachedMap = Object.fromEntries(cached.map((item) => [item.symbol, item]));
  const now = Date.now();
  const staleMs = cacheMinutes * 60 * 1000;
  const toFetch = refresh ? cleanSymbols : cleanSymbols.filter((symbol) => {
    const item = cachedMap[symbol];
    return !item || !item.fetchedAtMs || now - item.fetchedAtMs > staleMs;
  });

  let fetched = [];
  if (toFetch.length) {
    try {
      fetched = await fetchProviderPrices(env, toFetch);
      await savePriceCache(env, fetched);
    } catch (error) {
      console.warn(JSON.stringify({
        event: 'crypto_price_fetch_failed',
        symbols: toFetch,
        message: error.message || String(error),
      }));
    }
  }

  const fetchedMap = Object.fromEntries(fetched.map((item) => [item.symbol, item]));
  return cleanSymbols.map((symbol) => {
    const item = fetchedMap[symbol] || cachedMap[symbol] || emptyPrice(symbol);
    return priceShape(item);
  });
}

async function cachedPrices(env, symbols) {
  if (!symbols.length) return [];
  const placeholders = symbols.map(() => '?').join(',');
  const rows = await env.DB.prepare(`
    SELECT symbol, asset_id, name, price_usd, change_24h, market_cap_usd, volume_24h_usd, source, fetched_at
    FROM crypto_price_cache
    WHERE symbol IN (${placeholders})
  `).bind(...symbols).all();

  return (rows.results || []).map((row) => ({
    symbol: normalizeSymbol(row.symbol),
    assetId: row.asset_id || ASSET_IDS[normalizeSymbol(row.symbol)] || '',
    name: row.name || title(row.symbol),
    priceUsd: round(row.price_usd || 0),
    change24h: round(row.change_24h || 0),
    marketCapUsd: round(row.market_cap_usd || 0),
    volume24hUsd: round(row.volume_24h_usd || 0),
    source: row.source || 'cache',
    fetchedAt: row.fetched_at || '',
    fetchedAtMs: row.fetched_at ? Date.parse(row.fetched_at) : 0,
  }));
}

async function savePriceCache(env, prices) {
  await Promise.all(prices.map((item) => env.DB.prepare(`
    INSERT INTO crypto_price_cache (
      symbol, asset_id, name, price_usd, change_24h, market_cap_usd, volume_24h_usd, source, fetched_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(symbol) DO UPDATE SET
      asset_id = excluded.asset_id,
      name = excluded.name,
      price_usd = excluded.price_usd,
      change_24h = excluded.change_24h,
      market_cap_usd = excluded.market_cap_usd,
      volume_24h_usd = excluded.volume_24h_usd,
      source = excluded.source,
      fetched_at = CURRENT_TIMESTAMP
  `).bind(
    item.symbol,
    item.assetId || ASSET_IDS[item.symbol] || '',
    item.name || title(item.symbol),
    round(item.priceUsd || 0),
    round(item.change24h || 0),
    round(item.marketCapUsd || 0),
    round(item.volume24hUsd || 0),
    item.source || 'provider',
  ).run()));
}

async function fetchProviderPrices(env, symbols) {
  const config = await cryptoProviderConfig(env);
  if (config.provider === 'coinmarketcap') {
    return fetchCoinMarketCapPrices(config, symbols);
  }
  return fetchCoinGeckoPrices(config, symbols);
}

async function binanceAccountSnapshot(env, symbols, priceMap, exchangeRate) {
  const config = await binanceConfig(env);
  if (!config.apiKey || !config.apiSecret) {
    return {
      configured: false,
      balances: [],
      summary: emptyBinanceSummary(),
    };
  }

  try {
    const account = await fetchBinanceAccount(config);
    const balances = (account.balances || [])
      .map((row) => ({
        asset: normalizeSymbol(row.asset),
        free: Number(row.free || 0),
        locked: Number(row.locked || 0),
      }))
      .map((row) => ({ ...row, total: roundQuantity(row.free + row.locked) }))
      .filter((row) => row.asset && row.total > 0.00000001);

    const missingSymbols = balances
      .map((row) => row.asset)
      .filter((symbol) => !priceMap[symbol]?.priceUsd);
    const fetchedPrices = await fetchBinanceTickerPrices(config, missingSymbols);
    const mergedPriceMap = {
      ...priceMap,
      ...Object.fromEntries(fetchedPrices.map((item) => [item.symbol, item])),
    };

    const shapedBalances = balances
      .map((row) => {
        const priceUsd = stableUsdAsset(row.asset) ? 1 : Number(mergedPriceMap[row.asset]?.priceUsd || 0);
        const valueUsd = row.total * priceUsd;
        return {
          asset: row.asset,
          free: roundQuantity(row.free),
          locked: roundQuantity(row.locked),
          total: roundQuantity(row.total),
          priceUsd: round(priceUsd),
          valueUsd: round(valueUsd),
          valuePen: round(valueUsd * exchangeRate),
        };
      })
      .filter((row) => row.valueUsd > 0 || row.total > 0)
      .sort((a, b) => b.valueUsd - a.valueUsd || a.asset.localeCompare(b.asset));

    const totalValueUsd = round(shapedBalances.reduce((sum, row) => sum + row.valueUsd, 0));
    return {
      configured: true,
      accountType: account.accountType || 'SPOT',
      balances: shapedBalances,
      summary: {
        assets: shapedBalances.length,
        totalValueUsd,
        totalValuePen: round(totalValueUsd * exchangeRate),
      },
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'binance_account_failed',
      message: error.message || String(error),
    }));
    return {
      configured: true,
      error: binanceFriendlyError(error),
      balances: [],
      summary: emptyBinanceSummary(),
    };
  }
}

async function fetchBinanceAccount(config) {
  const query = `timestamp=${Date.now()}&recvWindow=5000`;
  const signature = await hmacSha256Hex(query, config.apiSecret);
  const response = await fetch(`${config.apiUrl}/api/v3/account?${query}&signature=${signature}`, {
    headers: {
      accept: 'application/json',
      'X-MBX-APIKEY': config.apiKey,
    },
    signal: timeoutSignal(7000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.msg ? `Binance HTTP ${response.status}: ${data.msg}` : `Binance HTTP ${response.status}`);
  }
  return data;
}

async function fetchBinanceTickerPrices(config, symbols) {
  const cleanSymbols = uniqueSymbols(symbols).filter((symbol) => !stableUsdAsset(symbol));
  if (!cleanSymbols.length) return [];

  const pairs = cleanSymbols.map((symbol) => `${symbol}USDT`);
  const url = new URL(`${config.apiUrl}/api/v3/ticker/price`);
  url.searchParams.set('symbols', JSON.stringify(pairs));
  const response = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
    signal: timeoutSignal(7000),
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error(`Binance ticker HTTP ${response.status}`);
  return (Array.isArray(data) ? data : [])
    .map((row) => {
      const symbol = String(row.symbol || '').replace(/USDT$/i, '').toUpperCase();
      return {
        symbol,
        assetId: symbol,
        name: title(symbol),
        priceUsd: round(row.price || 0),
        change24h: 0,
        marketCapUsd: 0,
        volume24hUsd: 0,
        source: 'binance',
        fetchedAt: new Date().toISOString(),
      };
    })
    .filter((item) => item.symbol && item.priceUsd > 0);
}

async function fetchCoinGeckoPrices(config, symbols) {
  const idPairs = symbols
    .map((symbol) => [symbol, ASSET_IDS[symbol]])
    .filter(([, id]) => Boolean(id));
  if (!idPairs.length) return [];

  const ids = idPairs.map(([, id]) => id).join(',');
  const baseUrl = config.apiUrl || (config.provider === 'coingecko-pro'
    ? 'https://pro-api.coingecko.com/api/v3/simple/price'
    : 'https://api.coingecko.com/api/v3/simple/price');
  const url = new URL(baseUrl);
  url.searchParams.set('ids', ids);
  url.searchParams.set('vs_currencies', 'usd');
  url.searchParams.set('include_24hr_change', 'true');
  url.searchParams.set('include_market_cap', 'true');
  url.searchParams.set('include_24hr_vol', 'true');

  const headers = { accept: 'application/json' };
  if (config.apiKey) {
    headers[config.headerName || (config.provider === 'coingecko-pro' ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key')] = config.apiKey;
  }

  const response = await fetch(url.toString(), {
    headers,
    signal: timeoutSignal(7000),
  });
  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
  const data = await response.json();

  return idPairs.map(([symbol, id]) => {
    const row = data?.[id] || {};
    return {
      symbol,
      assetId: id,
      name: title(symbol),
      priceUsd: round(row.usd || 0),
      change24h: round(row.usd_24h_change || 0),
      marketCapUsd: round(row.usd_market_cap || 0),
      volume24hUsd: round(row.usd_24h_vol || 0),
      source: config.provider,
      fetchedAt: new Date().toISOString(),
    };
  }).filter((item) => item.priceUsd > 0);
}

async function fetchCoinMarketCapPrices(config, symbols) {
  if (!config.apiKey) throw new Error('CRYPTO_API_KEY requerido para CoinMarketCap');
  const baseUrl = config.apiUrl || 'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest';
  const url = new URL(baseUrl);
  url.searchParams.set('symbol', symbols.join(','));
  url.searchParams.set('convert', 'USD');

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      [config.headerName || 'X-CMC_PRO_API_KEY']: config.apiKey,
    },
    signal: timeoutSignal(7000),
  });
  if (!response.ok) throw new Error(`CoinMarketCap HTTP ${response.status}`);
  const data = await response.json();

  return symbols.map((symbol) => {
    const raw = data?.data?.[symbol];
    const item = Array.isArray(raw) ? raw[0] : raw;
    const quote = item?.quote?.USD || {};
    return {
      symbol,
      assetId: item?.slug || ASSET_IDS[symbol] || '',
      name: item?.name || title(symbol),
      priceUsd: round(quote.price || 0),
      change24h: round(quote.percent_change_24h || 0),
      marketCapUsd: round(quote.market_cap || 0),
      volume24hUsd: round(quote.volume_24h || 0),
      source: 'coinmarketcap',
      fetchedAt: new Date().toISOString(),
    };
  }).filter((item) => item.priceUsd > 0);
}

async function cryptoProviderConfig(env) {
  const provider = normalizeProvider(await getAppSetting(env, 'crypto_api_provider') || env.CRYPTO_API_PROVIDER || 'coingecko');
  const apiUrl = String(await getAppSetting(env, 'crypto_api_url') || env.CRYPTO_API_URL || '').trim();
  const headerName = String(await getAppSetting(env, 'crypto_api_header') || env.CRYPTO_API_HEADER || '').trim();
  return {
    provider,
    apiUrl,
    headerName,
    apiKey: String(env.CRYPTO_API_KEY || '').trim(),
  };
}

async function binanceConfig(env) {
  return {
    apiUrl: String(await getAppSetting(env, 'binance_api_url') || env.BINANCE_API_URL || 'https://api.binance.com').trim().replace(/\/+$/g, ''),
    apiKey: String(env.BINANCE_API_KEY || '').trim(),
    apiSecret: String(env.BINANCE_API_SECRET || '').trim(),
  };
}

async function cryptoCacheMinutes(env) {
  const configured = Number(await getAppSetting(env, 'crypto_price_cache_minutes') || env.CRYPTO_PRICE_CACHE_MINUTES || CACHE_MINUTES);
  if (!Number.isFinite(configured)) return CACHE_MINUTES;
  return Math.max(1, Math.min(60, Math.trunc(configured)));
}

function buildPositions(operations, priceMap, exchangeRate) {
  const bySymbol = {};
  for (const row of operations) {
    const symbol = normalizeSymbol(row.symbol);
    if (!symbol) continue;
    if (!bySymbol[symbol]) {
      bySymbol[symbol] = {
        symbol,
        name: row.asset_name || title(symbol),
        quantity: 0,
        investedUsd: 0,
        realizedUsd: 0,
        buys: 0,
        sells: 0,
      };
    }

    const position = bySymbol[symbol];
    const quantity = Number(row.quantity || 0);
    const costUsd = quantity * Number(row.unit_price_usd || 0);

    if (row.type === 'sell') {
      const avgCost = position.quantity > 0 ? position.investedUsd / position.quantity : 0;
      const releasedCost = avgCost * quantity;
      position.quantity -= quantity;
      position.investedUsd = Math.max(position.investedUsd - releasedCost, 0);
      position.realizedUsd += costUsd - releasedCost;
      position.sells += 1;
    } else {
      position.quantity += quantity;
      position.investedUsd += costUsd;
      position.buys += 1;
    }
  }

  return Object.values(bySymbol)
    .filter((item) => item.quantity > 0.00000001 || item.realizedUsd !== 0)
    .map((item) => {
      const price = priceMap[item.symbol] || emptyPrice(item.symbol);
      const currentPriceUsd = Number(price.priceUsd || 0);
      const currentValueUsd = item.quantity * currentPriceUsd;
      const unrealizedUsd = currentValueUsd - item.investedUsd;
      const gainUsd = unrealizedUsd + item.realizedUsd;
      const gainPct = item.investedUsd > 0 ? (unrealizedUsd / item.investedUsd) * 100 : 0;
      return {
        symbol: item.symbol,
        name: price.name || item.name,
        quantity: roundQuantity(item.quantity),
        currentPriceUsd: round(currentPriceUsd),
        investedUsd: round(item.investedUsd),
        currentValueUsd: round(currentValueUsd),
        currentValuePen: round(currentValueUsd * exchangeRate),
        gainUsd: round(gainUsd),
        gainPen: round(gainUsd * exchangeRate),
        gainPct: round(gainPct),
        change24h: round(price.change24h || 0),
        realizedUsd: round(item.realizedUsd),
        source: price.source || 'sin precio',
        updatedAt: price.fetchedAt || '',
        buys: item.buys,
        sells: item.sells,
      };
    })
    .sort((a, b) => b.currentValueUsd - a.currentValueUsd || a.symbol.localeCompare(b.symbol));
}

function buildSummary(positions, exchangeRate, binance) {
  const totalInvestedUsd = round(positions.reduce((sum, item) => sum + item.investedUsd, 0));
  const totalValueUsd = round(positions.reduce((sum, item) => sum + item.currentValueUsd, 0));
  const gainUsd = round(totalValueUsd - totalInvestedUsd + positions.reduce((sum, item) => sum + item.realizedUsd, 0));
  const binanceValueUsd = round(binance?.summary?.totalValueUsd || 0);
  const binanceValuePen = round(binance?.summary?.totalValuePen || binanceValueUsd * exchangeRate);
  return {
    totalInvestedUsd,
    totalValueUsd,
    gainUsd,
    gainPct: totalInvestedUsd > 0 ? round((gainUsd / totalInvestedUsd) * 100) : 0,
    totalInvestedPen: round(totalInvestedUsd * exchangeRate),
    totalValuePen: round(totalValueUsd * exchangeRate),
    gainPen: round(gainUsd * exchangeRate),
    binanceValueUsd,
    binanceValuePen,
    totalCryptoValueUsd: round(totalValueUsd + binanceValueUsd),
    totalCryptoValuePen: round((totalValueUsd * exchangeRate) + binanceValuePen),
    positions: positions.length,
  };
}

function cryptoSuggestions({ summary, positions, alerts }) {
  const suggestions = [];
  if (!positions.length) {
    suggestions.push({
      level: 'info',
      title: 'Empieza pequeno',
      message: 'Registra una compra pequena y usa alertas antes de aumentar exposicion.',
    });
    return suggestions;
  }

  if (summary.gainPct <= -10) {
    suggestions.push({
      level: 'warning',
      title: 'Perdida relevante',
      message: `Tu cartera cripto va ${summary.gainPct.toFixed(1)}%. Revisa si fue compra planificada o impulso.`,
    });
  } else if (summary.gainPct >= 15) {
    suggestions.push({
      level: 'success',
      title: 'Ganancia para proteger',
      message: 'Evalua tomar una parte de ganancia o subir alertas de salida.',
    });
  }

  const concentrated = positions.find((item) => summary.totalValueUsd > 0 && item.currentValueUsd / summary.totalValueUsd > 0.7);
  if (concentrated) {
    suggestions.push({
      level: 'warning',
      title: 'Concentracion alta',
      message: `${concentrated.symbol} concentra mas del 70% de tu cartera cripto.`,
    });
  }

  if (!alerts.length) {
    suggestions.push({
      level: 'info',
      title: 'Agrega alertas',
      message: 'Define precios de compra o salida para no estar mirando el mercado a cada rato.',
    });
  }

  suggestions.push({
    level: 'info',
    title: 'Regla de caja',
    message: 'Invierte solo excedente del ciclo; no uses dinero de fijos, deudas o presupuesto pendiente.',
  });

  return suggestions.slice(0, 4);
}

function normalizeOperation(raw, chatId) {
  const symbol = normalizeSymbol(raw.symbol || raw.simbolo);
  const type = normalizeOperationType(raw.type || raw.tipo);
  const quantity = parseAmount(raw.quantity ?? raw.cantidad);
  const unitPriceUsd = parseAmount(raw.unitPriceUsd ?? raw.unit_price_usd ?? raw.precioUsd ?? raw.precio);
  const currency = normalizeCurrency(raw.currency || raw.moneda || 'USD');
  const exchangeRate = Number(raw.exchangeRate || raw.exchange_rate || 3.85) || 3.85;
  const fallbackTotal = currency === 'PEN' ? quantity * unitPriceUsd * exchangeRate : quantity * unitPriceUsd;
  const totalAmount = parseAmount(raw.totalAmount ?? raw.total_amount ?? raw.total ?? fallbackTotal);
  const operationDate = normalizeDateOnly(raw.operationDate || raw.operation_date || raw.fecha) || localDateKey(new Date());
  const notes = String(raw.notes || raw.notas || '').trim().slice(0, 240);

  if (!symbol) throw httpError(400, 'simbolo requerido');
  if (quantity <= 0) throw httpError(400, 'cantidad invalida');
  if (unitPriceUsd <= 0) throw httpError(400, 'precio USD invalido');
  if (totalAmount <= 0) throw httpError(400, 'total invalido');

  return {
    id: String(raw.id || `cryptoop:${chatId}:${crypto.randomUUID()}`).slice(0, 180),
    chat_id: chatId,
    symbol,
    asset_name: String(raw.assetName || raw.asset_name || title(symbol)).trim().slice(0, 80),
    type,
    quantity,
    unit_price_usd: round(unitPriceUsd),
    total_amount: round(totalAmount),
    currency,
    operation_date: operationDate,
    notes,
  };
}

function normalizeAlert(raw, chatId) {
  const symbol = normalizeSymbol(raw.symbol || raw.simbolo);
  const condition = normalizeAlertCondition(raw.condition || raw.condicion);
  const targetPriceUsd = parseAmount(raw.targetPriceUsd ?? raw.target_price_usd ?? raw.precioObjetivo ?? raw.precio);
  const notes = String(raw.notes || raw.notas || '').trim().slice(0, 180);

  if (!symbol) throw httpError(400, 'simbolo requerido');
  if (targetPriceUsd <= 0) throw httpError(400, 'precio objetivo invalido');

  return {
    id: String(raw.id || `cryptoalert:${chatId}:${symbol}:${condition}:${round(targetPriceUsd)}`).slice(0, 180),
    chat_id: chatId,
    symbol,
    condition,
    target_price_usd: round(targetPriceUsd),
    notes,
  };
}

function operationShape(row) {
  const quantity = Number(row.quantity || 0);
  const unitPriceUsd = round(row.unit_price_usd || row.unitPriceUsd || 0);
  return {
    id: row.id,
    symbol: normalizeSymbol(row.symbol),
    assetName: row.asset_name || row.assetName || title(row.symbol),
    type: row.type === 'sell' ? 'sell' : 'buy',
    quantity,
    unitPriceUsd,
    totalAmount: round(row.total_amount || row.totalAmount || quantity * unitPriceUsd),
    currency: normalizeCurrency(row.currency || 'USD'),
    operationDate: row.operation_date || row.operationDate || '',
    notes: row.notes || '',
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
  };
}

function alertShape(row, price) {
  const condition = row.condition === 'above' ? 'above' : 'below';
  const targetPriceUsd = round(row.target_price_usd || row.targetPriceUsd || 0);
  const currentPriceUsd = round(price?.priceUsd || 0);
  const triggered = currentPriceUsd > 0 && (condition === 'above'
    ? currentPriceUsd >= targetPriceUsd
    : currentPriceUsd <= targetPriceUsd);
  return {
    id: row.id,
    symbol: normalizeSymbol(row.symbol),
    condition,
    targetPriceUsd,
    currentPriceUsd,
    triggered,
    active: row.active !== 0,
    lastTriggeredAt: row.last_triggered_at || row.lastTriggeredAt || '',
    notes: row.notes || '',
    updatedAt: row.updated_at || row.updatedAt || '',
  };
}

function priceShape(item) {
  return {
    symbol: normalizeSymbol(item.symbol),
    assetId: item.assetId || item.asset_id || ASSET_IDS[normalizeSymbol(item.symbol)] || '',
    name: item.name || title(item.symbol),
    priceUsd: round(item.priceUsd || item.price_usd || 0),
    change24h: round(item.change24h || item.change_24h || 0),
    marketCapUsd: round(item.marketCapUsd || item.market_cap_usd || 0),
    volume24hUsd: round(item.volume24hUsd || item.volume_24h_usd || 0),
    source: item.source || 'sin precio',
    fetchedAt: item.fetchedAt || item.fetched_at || '',
  };
}

function emptyPrice(symbol) {
  return {
    symbol,
    assetId: ASSET_IDS[symbol] || '',
    name: title(symbol),
    priceUsd: 0,
    change24h: 0,
    marketCapUsd: 0,
    volume24hUsd: 0,
    source: 'sin precio',
    fetchedAt: '',
  };
}

function emptyBinanceSummary() {
  return {
    assets: 0,
    totalValueUsd: 0,
    totalValuePen: 0,
  };
}

function stableUsdAsset(symbol) {
  return ['USDT', 'USDC', 'BUSD', 'TUSD', 'FDUSD', 'DAI', 'USD'].includes(normalizeSymbol(symbol));
}

function binanceFriendlyError(error) {
  const message = error.message || String(error);
  if (/ip|restricted|permission|api-key|invalid/i.test(message)) {
    return `${message}. Revisa permisos y restriccion IP: Cloudflare Worker no sale desde una IP local como 192.168.x.x.`;
  }
  return message;
}

function normalizeSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return symbol.slice(0, 12);
}

function parseSymbols(value) {
  return String(value || '')
    .split(',')
    .map(normalizeSymbol)
    .filter(Boolean);
}

function uniqueSymbols(values) {
  return [...new Set(values.map(normalizeSymbol).filter(Boolean))].slice(0, 30);
}

function normalizeOperationType(value) {
  const key = normalizeKey(value || 'buy');
  if (key === 'sell' || key === 'venta' || key === 'vender') return 'sell';
  return 'buy';
}

function normalizeAlertCondition(value) {
  const key = normalizeKey(value || 'below');
  if (key === 'above' || key === 'encima' || key === 'arriba' || key === 'mayor') return 'above';
  return 'below';
}

function normalizeProvider(value) {
  const key = normalizeKey(value);
  if (key === 'coinmarketcap' || key === 'cmc') return 'coinmarketcap';
  if (key === 'coingecko-pro' || key === 'coingecko pro') return 'coingecko-pro';
  return 'coingecko';
}

function roundQuantity(value) {
  return Math.round((Number(value) || 0) * 100000000) / 100000000;
}
