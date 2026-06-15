import { httpError } from '../../shared/http.js';
import { parseAmount, round } from '../../shared/money.js';
import { getChatId } from '../../shared/request.js';
import { normalizeKey } from '../../shared/normalizers.js';
import { cryptoPortfolio } from '../investments/crypto.js';

const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'SOL'];
const DEFAULT_STRATEGY_NAME = 'Bot cripto seguro';

export async function tradingDashboard(env, params) {
  const chatId = getChatId(env, params);
  const strategy = await ensureDefaultStrategy(env, chatId);
  const [signals, orders, scalperRuns] = await Promise.all([
    tradingSignalsList(env, chatId),
    tradingOrdersList(env, chatId),
    tradingScalperRunsList(env, chatId),
  ]);

  return {
    ok: true,
    strategy: strategyShape(strategy),
    summary: tradingSummary(signals, orders),
    signals: signals.map(signalShape),
    orders: orders.map(orderShape),
    scalperRuns: scalperRuns.map(scalperRunShape),
    safety: safetyNotes(strategy),
    updatedAt: new Date().toISOString(),
  };
}

export async function upsertTradingStrategy(env, payload, params) {
  const chatId = getChatId(env, params);
  const current = await ensureDefaultStrategy(env, chatId);
  const strategy = normalizeStrategy(payload, chatId, current);

  await env.DB.prepare(`
    INSERT INTO trading_strategies (
      id, chat_id, name, mode, symbols, base_currency, allocation_usd,
      max_daily_loss_usd, max_trades_per_day, buy_drop_pct, take_profit_pct,
      stop_loss_pct, trailing_stop_pct, rsi_buy_below, cooldown_minutes,
      scalper_ticks, scalper_take_profit_pct, scalper_stop_loss_pct,
      scalper_fee_pct, scalper_spread_pct, scalper_max_round_trips,
      active, notes, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      mode = excluded.mode,
      symbols = excluded.symbols,
      base_currency = excluded.base_currency,
      allocation_usd = excluded.allocation_usd,
      max_daily_loss_usd = excluded.max_daily_loss_usd,
      max_trades_per_day = excluded.max_trades_per_day,
      buy_drop_pct = excluded.buy_drop_pct,
      take_profit_pct = excluded.take_profit_pct,
      stop_loss_pct = excluded.stop_loss_pct,
      trailing_stop_pct = excluded.trailing_stop_pct,
      rsi_buy_below = excluded.rsi_buy_below,
      cooldown_minutes = excluded.cooldown_minutes,
      scalper_ticks = excluded.scalper_ticks,
      scalper_take_profit_pct = excluded.scalper_take_profit_pct,
      scalper_stop_loss_pct = excluded.scalper_stop_loss_pct,
      scalper_fee_pct = excluded.scalper_fee_pct,
      scalper_spread_pct = excluded.scalper_spread_pct,
      scalper_max_round_trips = excluded.scalper_max_round_trips,
      active = excluded.active,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    strategy.id,
    strategy.chat_id,
    strategy.name,
    strategy.mode,
    strategy.symbols,
    strategy.base_currency,
    strategy.allocation_usd,
    strategy.max_daily_loss_usd,
    strategy.max_trades_per_day,
    strategy.buy_drop_pct,
    strategy.take_profit_pct,
    strategy.stop_loss_pct,
    strategy.trailing_stop_pct,
    strategy.rsi_buy_below,
    strategy.cooldown_minutes,
    strategy.scalper_ticks,
    strategy.scalper_take_profit_pct,
    strategy.scalper_stop_loss_pct,
    strategy.scalper_fee_pct,
    strategy.scalper_spread_pct,
    strategy.scalper_max_round_trips,
    strategy.active,
    strategy.notes,
  ).run();

  return tradingDashboard(env, params);
}

export async function runPaperScalper(env, params, payload = {}) {
  const chatId = getChatId(env, params);
  const strategy = await ensureDefaultStrategy(env, chatId);
  const shapedStrategy = strategyShape(strategy);

  if (!shapedStrategy.active || shapedStrategy.mode === 'off') {
    return {
      ...(await tradingDashboard(env, params)),
      scalper: null,
      message: 'Scalper apagado. Activa Paper para ejecutar rafagas simuladas.',
    };
  }

  const config = normalizeScalperConfig(payload, shapedStrategy);
  const portfolioParams = new URLSearchParams(params);
  portfolioParams.set('chat_id', chatId);
  portfolioParams.set('symbols', config.symbols.join(','));
  portfolioParams.set('refresh', '1');
  const portfolio = await cryptoPortfolio(env, portfolioParams, { refresh: true });
  const priceMap = Object.fromEntries((portfolio.prices || []).map((item) => [item.symbol, item]));
  const runId = `scalper-run:${chatId}:${crypto.randomUUID()}`;
  const startedAt = new Date();
  const states = buildScalperStates(config.symbols, priceMap);
  const openBySymbol = {};
  const closedTrades = [];
  const openedTrades = [];
  const events = [];

  for (let tick = 0; tick < config.ticks; tick += 1) {
    for (const symbol of config.symbols) {
      const state = states[symbol];
      if (!state || state.priceUsd <= 0) continue;

      const tickTime = new Date(startedAt.getTime() + tick * 1000);
      const priceUsd = nextScalperPrice(state, tick, config);
      const open = openBySymbol[symbol];

      if (open) {
        const exit = scalperExit(open, priceUsd, tick, config, tick === config.ticks - 1);
        if (exit) {
          delete openBySymbol[symbol];
          closedTrades.push(exit);
          events.push({
            tick,
            symbol,
            type: 'close',
            reason: exit.reason,
            priceUsd: exit.close_price_usd,
            pnlUsd: exit.pnl_usd,
          });
          await insertScalperClosedOrder(env, {
            ...exit,
            id: `trading-order:${chatId}:${crypto.randomUUID()}`,
            chat_id: chatId,
            signal_id: '',
            strategy_id: strategy.id,
            side: 'buy',
            mode: 'paper_scalper',
            status: 'closed',
            opened_at: sqlDateTime(open.openedAt),
            closed_at: sqlDateTime(tickTime),
            details_json: JSON.stringify({
              runId,
              entryTick: open.entryTick,
              exitTick: tick,
              grossPnlUsd: exit.gross_pnl_usd,
              feePct: config.feePct,
              spreadPct: config.spreadPct,
            }),
          });
          await insertSignal(env, scalperSignal(chatId, strategy.id, exit, 'sell', 'paper_closed', `Scalper cerro por ${exit.reason}`, runId));
        }
        continue;
      }

      if (openedTrades.length >= config.maxRoundTrips) continue;
      if (!shouldOpenScalper(state, tick, config)) continue;

      const entryPriceUsd = round(priceUsd * (1 + config.spreadPct / 200));
      const notionalUsd = config.allocationUsd;
      const quantity = roundQuantity(notionalUsd / entryPriceUsd);
      const feeUsd = round(notionalUsd * config.feePct / 100);
      const openTrade = {
        symbol,
        entryTick: tick,
        openedAt: tickTime,
        price_usd: entryPriceUsd,
        quantity,
        notional_usd: notionalUsd,
        fee_entry_usd: feeUsd,
        take_profit_price_usd: round(entryPriceUsd * (1 + config.takeProfitPct / 100)),
        stop_loss_price_usd: round(entryPriceUsd * (1 - config.stopLossPct / 100)),
        reason: `Scalper paper abrio por micro-caida en ${symbol}.`,
      };
      openBySymbol[symbol] = openTrade;
      openedTrades.push(openTrade);
      events.push({
        tick,
        symbol,
        type: 'open',
        priceUsd: entryPriceUsd,
        notionalUsd,
      });
      await insertSignal(env, scalperSignal(chatId, strategy.id, openTrade, 'buy', 'paper_open', openTrade.reason, runId));
    }
  }

  const run = scalperRunSummary({
    runId,
    chatId,
    strategyId: strategy.id,
    config,
    startedAt,
    closedTrades,
    openedTrades,
    events,
  });
  await insertScalperRun(env, run);

  return {
    ...(await tradingDashboard(env, params)),
    scalper: scalperRunShape(run),
    message: run.closed_orders
      ? `Scalper paper completo: ${run.closed_orders} cierres, neto ${formatUsd(run.net_pnl_usd)}.`
      : 'Scalper paper completo: no hubo entradas claras en esta rafaga.',
  };
}

export async function runTradingBot(env, params, payload = {}) {
  const chatId = getChatId(env, params);
  const strategy = await ensureDefaultStrategy(env, chatId);
  const shapedStrategy = strategyShape(strategy);

  if (!shapedStrategy.active || shapedStrategy.mode === 'off') {
    return {
      ...(await tradingDashboard(env, params)),
      analysis: [],
      generatedSignals: [],
      closedOrders: [],
      message: 'Bot apagado. Cambia el modo para analizar oportunidades.',
    };
  }

  const portfolioParams = new URLSearchParams(params);
  portfolioParams.set('chat_id', chatId);
  portfolioParams.set('symbols', shapedStrategy.symbols.join(','));
  if (payload.refresh !== false) portfolioParams.set('refresh', '1');
  const portfolio = await cryptoPortfolio(env, portfolioParams, { refresh: payload.refresh !== false });
  const priceMap = Object.fromEntries((portfolio.prices || []).map((item) => [item.symbol, item]));

  const closedOrders = await closeTriggeredPaperOrders(env, chatId, strategy, priceMap);
  const dailyCount = await openOrdersTodayCount(env, chatId);
  const createdSignals = [];
  const analysis = [];

  for (const symbol of shapedStrategy.symbols) {
    const price = priceMap[symbol];
    const item = analyzeSymbol(symbol, price, shapedStrategy);
    analysis.push(item);

    if (item.action !== 'buy') continue;
    if (dailyCount + createdSignals.length >= shapedStrategy.maxTradesPerDay) {
      item.action = 'wait';
      item.reason = `Limite diario alcanzado: ${shapedStrategy.maxTradesPerDay} operaciones paper.`;
      continue;
    }

    const hasRecent = await hasRecentSignal(env, strategy.id, symbol, 'buy', shapedStrategy.cooldownMinutes);
    if (hasRecent) {
      item.action = 'wait';
      item.reason = `Ya existe una senal reciente para ${symbol}. Cooldown ${shapedStrategy.cooldownMinutes} min.`;
      continue;
    }

    const signal = signalFromAnalysis(chatId, strategy, item, shapedStrategy.mode);
    await insertSignal(env, signal);
    createdSignals.push(signalShape(signal));

    if (shapedStrategy.mode === 'paper') {
      const order = paperOrderFromSignal(signal, 'open', item.reason);
      await insertOrder(env, order);
    }
  }

  return {
    ...(await tradingDashboard(env, params)),
    analysis,
    generatedSignals: createdSignals,
    closedOrders: closedOrders.map(orderShape),
    message: createdSignals.length
      ? `${createdSignals.length} senal(es) creadas.`
      : 'Sin compras claras ahora. Mejor esperar que forzar una entrada.',
  };
}

export async function decideTradingSignal(env, id, payload, params) {
  const chatId = getChatId(env, params);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw httpError(400, 'id requerido');

  const decision = normalizeKey(payload.decision || payload.status || '');
  const status = decision === 'approve' || decision === 'aprobar' || decision === 'approved'
    ? 'approved'
    : 'rejected';

  const row = await env.DB.prepare(`
    SELECT *
    FROM trading_signals
    WHERE id = ? AND chat_id = ?
  `).bind(cleanId, chatId).first();
  if (!row) throw httpError(404, 'senal no encontrada');

  await env.DB.prepare(`
    UPDATE trading_signals
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(status, cleanId, chatId).run();

  return {
    ok: true,
    signal: signalShape({ ...row, status }),
    message: status === 'approved'
      ? 'Senal aprobada. No se ejecuto orden real; queda como aprobacion manual.'
      : 'Senal rechazada.',
  };
}

export async function closePaperOrder(env, id, payload, params) {
  const chatId = getChatId(env, params);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw httpError(400, 'id requerido');

  const order = await env.DB.prepare(`
    SELECT *
    FROM trading_orders
    WHERE id = ? AND chat_id = ? AND status = 'open'
  `).bind(cleanId, chatId).first();
  if (!order) throw httpError(404, 'paper order abierta no encontrada');

  let closePriceUsd = parseAmount(payload.closePriceUsd ?? payload.priceUsd ?? payload.price);
  if (closePriceUsd <= 0) {
    const portfolioParams = new URLSearchParams(params);
    portfolioParams.set('symbols', order.symbol);
    const portfolio = await cryptoPortfolio(env, portfolioParams, { refresh: true });
    closePriceUsd = Number((portfolio.prices || []).find((item) => item.symbol === order.symbol)?.priceUsd || 0);
  }
  if (closePriceUsd <= 0) throw httpError(400, 'precio de cierre requerido');

  const pnlUsd = paperPnl(order, closePriceUsd);
  const closed = {
    ...order,
    status: 'closed',
    close_price_usd: round(closePriceUsd),
    pnl_usd: pnlUsd,
    closed_at: sqlNow(),
    reason: String(payload.reason || 'Cierre manual paper').trim().slice(0, 240),
  };
  await updateClosedOrder(env, closed);

  return {
    ok: true,
    order: orderShape(closed),
    message: 'Operacion paper cerrada.',
  };
}

async function ensureDefaultStrategy(env, chatId) {
  const existing = await env.DB.prepare(`
    SELECT *
    FROM trading_strategies
    WHERE chat_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).bind(chatId).first();
  if (existing) return existing;

  const row = defaultStrategy(chatId);
  await env.DB.prepare(`
    INSERT OR IGNORE INTO trading_strategies (
      id, chat_id, name, mode, symbols, base_currency, allocation_usd,
      max_daily_loss_usd, max_trades_per_day, buy_drop_pct, take_profit_pct,
      stop_loss_pct, trailing_stop_pct, rsi_buy_below, cooldown_minutes,
      active, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    row.id,
    row.chat_id,
    row.name,
    row.mode,
    row.symbols,
    row.base_currency,
    row.allocation_usd,
    row.max_daily_loss_usd,
    row.max_trades_per_day,
    row.buy_drop_pct,
    row.take_profit_pct,
    row.stop_loss_pct,
    row.trailing_stop_pct,
    row.rsi_buy_below,
    row.cooldown_minutes,
    row.active,
    row.notes,
  ).run();
  return row;
}

async function tradingSignalsList(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT *
    FROM trading_signals
    WHERE chat_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).bind(chatId).all();
  return rows.results || [];
}

async function tradingOrdersList(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT *
    FROM trading_orders
    WHERE chat_id = ?
    ORDER BY COALESCE(closed_at, opened_at) DESC
    LIMIT 30
  `).bind(chatId).all();
  return rows.results || [];
}

async function tradingScalperRunsList(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT *
    FROM trading_scalper_runs
    WHERE chat_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).bind(chatId).all();
  return rows.results || [];
}

async function openOrdersTodayCount(env, chatId) {
  const start = sqlStartOfToday();
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM trading_orders
    WHERE chat_id = ? AND opened_at >= ?
  `).bind(chatId, start).first();
  return Number(row?.total || 0);
}

async function hasRecentSignal(env, strategyId, symbol, side, cooldownMinutes) {
  const cutoff = sqlDateTime(new Date(Date.now() - Number(cooldownMinutes || 240) * 60 * 1000));
  const row = await env.DB.prepare(`
    SELECT id
    FROM trading_signals
    WHERE strategy_id = ?
      AND symbol = ?
      AND side = ?
      AND status IN ('paper_open', 'pending_approval', 'approved')
      AND created_at >= ?
    LIMIT 1
  `).bind(strategyId, symbol, side, cutoff).first();
  return Boolean(row?.id);
}

async function closeTriggeredPaperOrders(env, chatId, strategy, priceMap) {
  const rows = await env.DB.prepare(`
    SELECT *
    FROM trading_orders
    WHERE chat_id = ? AND strategy_id = ? AND status = 'open' AND mode = 'paper'
    ORDER BY opened_at ASC
  `).bind(chatId, strategy.id).all();

  const closed = [];
  for (const row of rows.results || []) {
    const price = Number(priceMap[row.symbol]?.priceUsd || 0);
    if (price <= 0) continue;
    const takeProfit = Number(row.price_usd || 0) * (1 + Number(strategy.take_profit_pct || 3) / 100);
    const stopLoss = Number(row.price_usd || 0) * (1 - Number(strategy.stop_loss_pct || 1.5) / 100);
    const shouldTakeProfit = price >= takeProfit;
    const shouldStopLoss = price <= stopLoss;
    if (!shouldTakeProfit && !shouldStopLoss) continue;

    const item = {
      ...row,
      status: 'closed',
      close_price_usd: round(price),
      pnl_usd: paperPnl(row, price),
      closed_at: sqlNow(),
      reason: shouldTakeProfit ? 'Take profit paper alcanzado' : 'Stop loss paper alcanzado',
    };
    await updateClosedOrder(env, item);
    await insertSignal(env, {
      id: `trading-signal:${chatId}:${crypto.randomUUID()}`,
      chat_id: chatId,
      strategy_id: strategy.id,
      symbol: row.symbol,
      side: 'sell',
      status: 'paper_closed',
      mode: 'paper',
      signal_price_usd: item.close_price_usd,
      quantity: Number(row.quantity || 0),
      notional_usd: round(Number(row.quantity || 0) * item.close_price_usd),
      confidence: 100,
      reason: item.reason,
      take_profit_price_usd: 0,
      stop_loss_price_usd: 0,
      details_json: JSON.stringify({ source: 'paper_exit', pnlUsd: item.pnl_usd }),
    });
    closed.push(item);
  }
  return closed;
}

async function insertSignal(env, signal) {
  await env.DB.prepare(`
    INSERT INTO trading_signals (
      id, chat_id, strategy_id, symbol, side, status, mode, signal_price_usd,
      quantity, notional_usd, confidence, reason, take_profit_price_usd,
      stop_loss_price_usd, details_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    signal.id,
    signal.chat_id,
    signal.strategy_id,
    signal.symbol,
    signal.side,
    signal.status,
    signal.mode,
    signal.signal_price_usd,
    signal.quantity,
    signal.notional_usd,
    signal.confidence,
    signal.reason,
    signal.take_profit_price_usd,
    signal.stop_loss_price_usd,
    signal.details_json,
  ).run();
}

async function insertOrder(env, order) {
  await env.DB.prepare(`
    INSERT INTO trading_orders (
      id, chat_id, signal_id, strategy_id, symbol, side, mode, status,
      price_usd, quantity, notional_usd, fee_usd, pnl_usd, reason,
      details_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    order.id,
    order.chat_id,
    order.signal_id,
    order.strategy_id,
    order.symbol,
    order.side,
    order.mode,
    order.status,
    order.price_usd,
    order.quantity,
    order.notional_usd,
    order.fee_usd,
    order.pnl_usd,
    order.reason,
    order.details_json,
  ).run();
}

async function insertScalperClosedOrder(env, order) {
  await env.DB.prepare(`
    INSERT INTO trading_orders (
      id, chat_id, signal_id, strategy_id, symbol, side, mode, status,
      price_usd, quantity, notional_usd, fee_usd, pnl_usd, opened_at,
      closed_at, close_price_usd, reason, details_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    order.id,
    order.chat_id,
    order.signal_id,
    order.strategy_id,
    order.symbol,
    order.side,
    order.mode,
    order.status,
    order.price_usd,
    order.quantity,
    order.notional_usd,
    order.fee_usd,
    order.pnl_usd,
    order.opened_at,
    order.closed_at,
    order.close_price_usd,
    order.reason,
    order.details_json,
  ).run();
}

async function insertScalperRun(env, run) {
  await env.DB.prepare(`
    INSERT INTO trading_scalper_runs (
      id, chat_id, strategy_id, status, symbols, ticks, opened_orders,
      closed_orders, gross_pnl_usd, fees_usd, net_pnl_usd, best_trade_usd,
      worst_trade_usd, started_at, finished_at, details_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    run.id,
    run.chat_id,
    run.strategy_id,
    run.status,
    run.symbols,
    run.ticks,
    run.opened_orders,
    run.closed_orders,
    run.gross_pnl_usd,
    run.fees_usd,
    run.net_pnl_usd,
    run.best_trade_usd,
    run.worst_trade_usd,
    run.started_at,
    run.finished_at,
    run.details_json,
  ).run();
}

async function updateClosedOrder(env, order) {
  await env.DB.prepare(`
    UPDATE trading_orders
    SET status = 'closed',
        close_price_usd = ?,
        pnl_usd = ?,
        closed_at = ?,
        reason = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(
    order.close_price_usd,
    order.pnl_usd,
    order.closed_at,
    order.reason,
    order.id,
    order.chat_id,
  ).run();
}

function analyzeSymbol(symbol, price, strategy) {
  const priceUsd = round(price?.priceUsd || 0);
  const change24h = round(price?.change24h || 0);
  const source = price?.source || 'sin precio';
  const takeProfitPriceUsd = round(priceUsd * (1 + strategy.takeProfitPct / 100));
  const stopLossPriceUsd = round(priceUsd * (1 - strategy.stopLossPct / 100));
  const notionalUsd = strategy.allocationUsd;
  const quantity = priceUsd > 0 ? roundQuantity(notionalUsd / priceUsd) : 0;

  if (priceUsd <= 0) {
    return {
      symbol,
      action: 'wait',
      side: 'buy',
      priceUsd: 0,
      change24h: 0,
      confidence: 0,
      notionalUsd,
      quantity: 0,
      takeProfitPriceUsd: 0,
      stopLossPriceUsd: 0,
      reason: 'Sin precio confiable para analizar.',
      source,
    };
  }

  if (change24h <= -strategy.buyDropPct) {
    return {
      symbol,
      action: 'buy',
      side: 'buy',
      priceUsd,
      change24h,
      confidence: Math.min(92, Math.max(55, round(48 + Math.abs(change24h) * 7))),
      notionalUsd,
      quantity,
      takeProfitPriceUsd,
      stopLossPriceUsd,
      reason: `${symbol} cayo ${Math.abs(change24h).toFixed(2)}% en 24h. Entra en regla de compra por caida.`,
      source,
    };
  }

  if (change24h < 0 && Math.abs(change24h) >= strategy.buyDropPct * 0.5) {
    return {
      symbol,
      action: 'watch',
      side: 'buy',
      priceUsd,
      change24h,
      confidence: 45,
      notionalUsd,
      quantity,
      takeProfitPriceUsd,
      stopLossPriceUsd,
      reason: `${symbol} esta bajando, pero aun no llega al umbral de ${strategy.buyDropPct}%.`,
      source,
    };
  }

  return {
    symbol,
    action: 'wait',
    side: 'buy',
    priceUsd,
    change24h,
    confidence: change24h === 0 ? 35 : 30,
    notionalUsd,
    quantity,
    takeProfitPriceUsd,
    stopLossPriceUsd,
    reason: change24h === 0
      ? 'Precio actualizado, pero falta variacion 24h del proveedor para una senal fuerte.'
      : 'No hay descuento suficiente. Esperar es parte de la estrategia.',
    source,
  };
}

function signalFromAnalysis(chatId, strategy, item, mode) {
  const safeMode = mode === 'paper' ? 'paper' : 'confirm';
  return {
    id: `trading-signal:${chatId}:${crypto.randomUUID()}`,
    chat_id: chatId,
    strategy_id: strategy.id,
    symbol: item.symbol,
    side: item.side,
    status: safeMode === 'paper' ? 'paper_open' : 'pending_approval',
    mode: safeMode,
    signal_price_usd: item.priceUsd,
    quantity: item.quantity,
    notional_usd: item.notionalUsd,
    confidence: item.confidence,
    reason: item.reason,
    take_profit_price_usd: item.takeProfitPriceUsd,
    stop_loss_price_usd: item.stopLossPriceUsd,
    details_json: JSON.stringify({
      change24h: item.change24h,
      source: item.source,
      safety: 'No ejecuta orden real en ningun exchange.',
    }),
  };
}

function paperOrderFromSignal(signal, status, reason) {
  return {
    id: `trading-order:${signal.chat_id}:${crypto.randomUUID()}`,
    chat_id: signal.chat_id,
    signal_id: signal.id,
    strategy_id: signal.strategy_id,
    symbol: signal.symbol,
    side: signal.side,
    mode: 'paper',
    status,
    price_usd: signal.signal_price_usd,
    quantity: signal.quantity,
    notional_usd: signal.notional_usd,
    fee_usd: 0,
    pnl_usd: 0,
    reason,
    details_json: JSON.stringify({
      takeProfitPriceUsd: signal.take_profit_price_usd,
      stopLossPriceUsd: signal.stop_loss_price_usd,
    }),
  };
}

function tradingSummary(signals, orders) {
  const openOrders = orders.filter((item) => item.status === 'open');
  const closedOrders = orders.filter((item) => item.status === 'closed');
  const realizedPnlUsd = round(closedOrders.reduce((sum, item) => sum + Number(item.pnl_usd || 0), 0));
  const openExposureUsd = round(openOrders.reduce((sum, item) => sum + Number(item.notional_usd || 0), 0));
  const wins = closedOrders.filter((item) => Number(item.pnl_usd || 0) > 0).length;
  return {
    signals: signals.length,
    openOrders: openOrders.length,
    closedOrders: closedOrders.length,
    openExposureUsd,
    realizedPnlUsd,
    winRatePct: closedOrders.length ? round((wins / closedOrders.length) * 100) : 0,
    pendingApproval: signals.filter((item) => item.status === 'pending_approval').length,
  };
}

function normalizeStrategy(payload, chatId, current) {
  const symbols = parseSymbols(payload.symbols ?? payload.simbolos ?? current.symbols).join(',');
  return {
    id: String(payload.id || current.id || `trading-strategy:${chatId}:default`).slice(0, 180),
    chat_id: chatId,
    name: String(payload.name || payload.nombre || current.name || DEFAULT_STRATEGY_NAME).trim().slice(0, 80),
    mode: normalizeMode(payload.mode ?? current.mode),
    symbols: symbols || DEFAULT_SYMBOLS.join(','),
    base_currency: normalizeBaseCurrency(payload.baseCurrency || payload.base_currency || current.base_currency),
    allocation_usd: clamp(parseAmount(payload.allocationUsd ?? payload.allocation_usd ?? current.allocation_usd), 1, 1000, 10),
    max_daily_loss_usd: clamp(parseAmount(payload.maxDailyLossUsd ?? payload.max_daily_loss_usd ?? current.max_daily_loss_usd), 1, 5000, 5),
    max_trades_per_day: clampInt(payload.maxTradesPerDay ?? payload.max_trades_per_day ?? current.max_trades_per_day, 1, 20, 2),
    buy_drop_pct: clamp(parseAmount(payload.buyDropPct ?? payload.buy_drop_pct ?? current.buy_drop_pct), 0.5, 50, 3),
    take_profit_pct: clamp(parseAmount(payload.takeProfitPct ?? payload.take_profit_pct ?? current.take_profit_pct), 0.5, 100, 3),
    stop_loss_pct: clamp(parseAmount(payload.stopLossPct ?? payload.stop_loss_pct ?? current.stop_loss_pct), 0.5, 80, 1.5),
    trailing_stop_pct: clamp(parseAmount(payload.trailingStopPct ?? payload.trailing_stop_pct ?? current.trailing_stop_pct), 0.2, 50, 1.2),
    rsi_buy_below: clamp(parseAmount(payload.rsiBuyBelow ?? payload.rsi_buy_below ?? current.rsi_buy_below), 10, 70, 35),
    cooldown_minutes: clampInt(payload.cooldownMinutes ?? payload.cooldown_minutes ?? current.cooldown_minutes, 15, 10080, 240),
    scalper_ticks: clampInt(payload.scalperTicks ?? payload.scalper_ticks ?? current.scalper_ticks, 3, 60, 12),
    scalper_take_profit_pct: clamp(parseAmount(payload.scalperTakeProfitPct ?? payload.scalper_take_profit_pct ?? current.scalper_take_profit_pct), 0.05, 5, 0.6),
    scalper_stop_loss_pct: clamp(parseAmount(payload.scalperStopLossPct ?? payload.scalper_stop_loss_pct ?? current.scalper_stop_loss_pct), 0.05, 5, 0.4),
    scalper_fee_pct: clamp(parseAmount(payload.scalperFeePct ?? payload.scalper_fee_pct ?? current.scalper_fee_pct), 0, 1, 0.1),
    scalper_spread_pct: clamp(parseAmount(payload.scalperSpreadPct ?? payload.scalper_spread_pct ?? current.scalper_spread_pct), 0, 2, 0.05),
    scalper_max_round_trips: clampInt(payload.scalperMaxRoundTrips ?? payload.scalper_max_round_trips ?? current.scalper_max_round_trips, 1, 30, 6),
    active: payload.active === false || payload.active === 0 ? 0 : 1,
    notes: String(payload.notes ?? payload.notas ?? current.notes ?? '').trim().slice(0, 240),
  };
}

function defaultStrategy(chatId) {
  return {
    id: `trading-strategy:${chatId}:default`,
    chat_id: chatId,
    name: DEFAULT_STRATEGY_NAME,
    mode: 'paper',
    symbols: DEFAULT_SYMBOLS.join(','),
    base_currency: 'USDT',
    allocation_usd: 10,
    max_daily_loss_usd: 5,
    max_trades_per_day: 2,
    buy_drop_pct: 3,
    take_profit_pct: 3,
    stop_loss_pct: 1.5,
    trailing_stop_pct: 1.2,
    rsi_buy_below: 35,
    cooldown_minutes: 240,
    scalper_ticks: 12,
    scalper_take_profit_pct: 0.6,
    scalper_stop_loss_pct: 0.4,
    scalper_fee_pct: 0.1,
    scalper_spread_pct: 0.05,
    scalper_max_round_trips: 6,
    active: 1,
    notes: 'Estrategia segura: primero paper trading y confirmacion manual.',
  };
}

function strategyShape(row) {
  return {
    id: row.id,
    chatId: row.chat_id,
    name: row.name || DEFAULT_STRATEGY_NAME,
    mode: normalizeMode(row.mode),
    symbols: parseSymbols(row.symbols),
    baseCurrency: normalizeBaseCurrency(row.base_currency),
    allocationUsd: round(row.allocation_usd || 0),
    maxDailyLossUsd: round(row.max_daily_loss_usd || 0),
    maxTradesPerDay: Number(row.max_trades_per_day || 0),
    buyDropPct: round(row.buy_drop_pct || 0),
    takeProfitPct: round(row.take_profit_pct || 0),
    stopLossPct: round(row.stop_loss_pct || 0),
    trailingStopPct: round(row.trailing_stop_pct || 0),
    rsiBuyBelow: round(row.rsi_buy_below || 0),
    cooldownMinutes: Number(row.cooldown_minutes || 0),
    scalperTicks: Number(row.scalper_ticks || 12),
    scalperTakeProfitPct: round(row.scalper_take_profit_pct || 0.6),
    scalperStopLossPct: round(row.scalper_stop_loss_pct || 0.4),
    scalperFeePct: round(row.scalper_fee_pct || 0.1),
    scalperSpreadPct: round(row.scalper_spread_pct || 0.05),
    scalperMaxRoundTrips: Number(row.scalper_max_round_trips || 6),
    active: row.active !== 0,
    notes: row.notes || '',
    updatedAt: row.updated_at || row.updatedAt || '',
  };
}

function signalShape(row) {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    symbol: row.symbol,
    side: row.side,
    status: row.status,
    mode: row.mode,
    signalPriceUsd: round(row.signal_price_usd || 0),
    quantity: roundQuantity(row.quantity || 0),
    notionalUsd: round(row.notional_usd || 0),
    confidence: round(row.confidence || 0),
    reason: row.reason || '',
    takeProfitPriceUsd: round(row.take_profit_price_usd || 0),
    stopLossPriceUsd: round(row.stop_loss_price_usd || 0),
    details: parseDetails(row.details_json),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
  };
}

function orderShape(row) {
  return {
    id: row.id,
    signalId: row.signal_id || '',
    strategyId: row.strategy_id,
    symbol: row.symbol,
    side: row.side,
    mode: row.mode,
    status: row.status,
    priceUsd: round(row.price_usd || 0),
    quantity: roundQuantity(row.quantity || 0),
    notionalUsd: round(row.notional_usd || 0),
    feeUsd: round(row.fee_usd || 0),
    pnlUsd: round(row.pnl_usd || 0),
    openedAt: row.opened_at || '',
    closedAt: row.closed_at || '',
    closePriceUsd: round(row.close_price_usd || 0),
    reason: row.reason || '',
    details: parseDetails(row.details_json),
  };
}

function scalperRunShape(row) {
  const details = parseDetails(row.details_json);
  return {
    id: row.id,
    strategyId: row.strategy_id,
    status: row.status,
    symbols: parseSymbols(row.symbols),
    ticks: Number(row.ticks || 0),
    openedOrders: Number(row.opened_orders || 0),
    closedOrders: Number(row.closed_orders || 0),
    grossPnlUsd: round(row.gross_pnl_usd || 0),
    feesUsd: round(row.fees_usd || 0),
    netPnlUsd: round(row.net_pnl_usd || 0),
    bestTradeUsd: round(row.best_trade_usd || 0),
    worstTradeUsd: round(row.worst_trade_usd || 0),
    startedAt: row.started_at || '',
    finishedAt: row.finished_at || '',
    details,
  };
}

function normalizeScalperConfig(payload, strategy) {
  const symbols = parseSymbols(payload.symbols || strategy.symbols.join(','));
  return {
    symbols: symbols.length ? symbols : DEFAULT_SYMBOLS,
    ticks: clampInt(payload.ticks ?? strategy.scalperTicks, 3, 60, 12),
    allocationUsd: clamp(parseAmount(payload.allocationUsd ?? strategy.allocationUsd), 1, 1000, 10),
    takeProfitPct: clamp(parseAmount(payload.takeProfitPct ?? strategy.scalperTakeProfitPct), 0.05, 5, 0.6),
    stopLossPct: clamp(parseAmount(payload.stopLossPct ?? strategy.scalperStopLossPct), 0.05, 5, 0.4),
    feePct: clamp(parseAmount(payload.feePct ?? strategy.scalperFeePct), 0, 1, 0.1),
    spreadPct: clamp(parseAmount(payload.spreadPct ?? strategy.scalperSpreadPct), 0, 2, 0.05),
    maxRoundTrips: clampInt(payload.maxRoundTrips ?? strategy.scalperMaxRoundTrips, 1, 30, 6),
  };
}

function buildScalperStates(symbols, priceMap) {
  return Object.fromEntries(symbols.map((symbol) => {
    const price = priceMap[symbol] || {};
    return [symbol, {
      symbol,
      initialPriceUsd: Number(price.priceUsd || 0),
      priceUsd: Number(price.priceUsd || 0),
      change24h: Number(price.change24h || 0),
      seed: symbolSeed(symbol),
      lastMovePct: 0,
    }];
  }));
}

function nextScalperPrice(state, tick, config) {
  const volatilityPct = bounded(Math.abs(state.change24h) * 0.08 + 0.12, 0.08, 0.75);
  const trendPct = bounded(state.change24h / 180, -0.12, 0.12);
  const wave = Math.sin((tick + 1) * 1.618 + state.seed) * volatilityPct;
  const snap = Math.cos((tick + 2) * 0.91 + state.seed / 3) * volatilityPct * 0.45;
  const feePressure = config.spreadPct * 0.08;
  const movePct = bounded(trendPct + wave + snap - feePressure, -1.2, 1.2);
  state.priceUsd = round(Math.max(state.priceUsd * (1 + movePct / 100), 0));
  state.lastMovePct = movePct;
  return state.priceUsd;
}

function shouldOpenScalper(state, tick, config) {
  const triggerPct = bounded(config.takeProfitPct / 3, 0.08, 0.35);
  if (tick === 0) return true;
  if (state.lastMovePct <= -triggerPct) return true;
  const discountFromStartPct = state.initialPriceUsd > 0
    ? ((state.priceUsd - state.initialPriceUsd) / state.initialPriceUsd) * 100
    : 0;
  return discountFromStartPct <= -triggerPct * 1.5;
}

function scalperExit(open, priceUsd, tick, config, forceClose) {
  const closePriceUsd = round(priceUsd * (1 - config.spreadPct / 200));
  const hitTakeProfit = closePriceUsd >= open.take_profit_price_usd;
  const hitStopLoss = closePriceUsd <= open.stop_loss_price_usd;
  if (!hitTakeProfit && !hitStopLoss && !forceClose) return null;

  const exitNotionalUsd = closePriceUsd * open.quantity;
  const feeExitUsd = round(exitNotionalUsd * config.feePct / 100);
  const grossPnlUsd = round((closePriceUsd - open.price_usd) * open.quantity);
  const feeUsd = round(open.fee_entry_usd + feeExitUsd);
  const pnlUsd = round(grossPnlUsd - feeUsd);
  return {
    symbol: open.symbol,
    entry_tick: open.entryTick,
    exit_tick: tick,
    price_usd: open.price_usd,
    close_price_usd: closePriceUsd,
    quantity: open.quantity,
    notional_usd: open.notional_usd,
    fee_usd: feeUsd,
    gross_pnl_usd: grossPnlUsd,
    pnl_usd: pnlUsd,
    reason: hitTakeProfit ? 'take profit' : hitStopLoss ? 'stop loss' : 'cierre de rafaga',
  };
}

function scalperSignal(chatId, strategyId, trade, side, status, reason, runId) {
  const price = side === 'sell' ? trade.close_price_usd : trade.price_usd;
  return {
    id: `trading-signal:${chatId}:${crypto.randomUUID()}`,
    chat_id: chatId,
    strategy_id: strategyId,
    symbol: trade.symbol,
    side,
    status,
    mode: 'paper_scalper',
    signal_price_usd: round(price || 0),
    quantity: roundQuantity(trade.quantity || 0),
    notional_usd: round(trade.notional_usd || 0),
    confidence: side === 'sell' ? 100 : 70,
    reason,
    take_profit_price_usd: round(trade.take_profit_price_usd || 0),
    stop_loss_price_usd: round(trade.stop_loss_price_usd || 0),
    details_json: JSON.stringify({
      source: 'paper_scalper',
      runId,
      pnlUsd: trade.pnl_usd,
    }),
  };
}

function scalperRunSummary({ runId, chatId, strategyId, config, startedAt, closedTrades, openedTrades, events }) {
  const gross = round(closedTrades.reduce((sum, item) => sum + Number(item.gross_pnl_usd || 0), 0));
  const fees = round(closedTrades.reduce((sum, item) => sum + Number(item.fee_usd || 0), 0));
  const net = round(closedTrades.reduce((sum, item) => sum + Number(item.pnl_usd || 0), 0));
  const pnlValues = closedTrades.map((item) => Number(item.pnl_usd || 0));
  const finishedAt = new Date(startedAt.getTime() + config.ticks * 1000);
  return {
    id: runId,
    chat_id: chatId,
    strategy_id: strategyId,
    status: 'completed',
    symbols: config.symbols.join(','),
    ticks: config.ticks,
    opened_orders: openedTrades.length,
    closed_orders: closedTrades.length,
    gross_pnl_usd: gross,
    fees_usd: fees,
    net_pnl_usd: net,
    best_trade_usd: pnlValues.length ? round(Math.max(...pnlValues)) : 0,
    worst_trade_usd: pnlValues.length ? round(Math.min(...pnlValues)) : 0,
    started_at: sqlDateTime(startedAt),
    finished_at: sqlDateTime(finishedAt),
    details_json: JSON.stringify({
      config,
      events: events.slice(-80),
      closedTrades: closedTrades.slice(-30),
    }),
  };
}

function safetyNotes(strategy) {
  const mode = normalizeMode(strategy.mode);
  return [
    mode === 'paper'
      ? 'Modo paper: simula compras y ventas, no toca ningun exchange.'
      : 'Modo confirmacion: crea senales para aprobar manualmente, no ejecuta orden real.',
    'Scalper paper registra rafagas simuladas con fee y spread; no envia orden real.',
    'Usa montos pequenos y respeta presupuesto; cripto puede caer fuerte en minutos.',
  ];
}

function paperPnl(order, closePriceUsd) {
  const quantity = Number(order.quantity || 0);
  const entry = Number(order.price_usd || 0);
  const exit = Number(closePriceUsd || 0);
  const fee = Number(order.fee_usd || 0);
  return round((exit - entry) * quantity - fee);
}

function normalizeMode(value) {
  const key = normalizeKey(value || 'paper');
  if (key === 'off' || key === 'apagado') return 'off';
  if (key === 'confirm' || key === 'confirmation' || key === 'confirmacion' || key === 'auto') return 'confirm';
  return 'paper';
}

function normalizeBaseCurrency(value) {
  const currency = String(value || 'USDT').trim().toUpperCase().replace(/[^A-Z]/g, '');
  return ['USDT', 'USDC', 'USD'].includes(currency) ? currency : 'USDT';
}

function parseSymbols(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '');
  const symbols = raw
    .split(',')
    .map((item) => item.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))
    .filter(Boolean);
  return [...new Set(symbols)].slice(0, 8);
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return round(Math.max(min, Math.min(max, number)));
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(String(value), 10);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(min, Math.min(max, number));
}

function parseDetails(value) {
  try {
    return JSON.parse(String(value || '{}'));
  } catch {
    return {};
  }
}

function bounded(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function symbolSeed(symbol) {
  return String(symbol || '')
    .split('')
    .reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0) / 17;
}

function formatUsd(value) {
  const sign = Number(value || 0) < 0 ? '-' : '';
  return `${sign}US$ ${Math.abs(round(value)).toFixed(2)}`;
}

function roundQuantity(value) {
  return Math.round((Number(value) || 0) * 100000000) / 100000000;
}

function sqlNow() {
  return sqlDateTime(new Date());
}

function sqlStartOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return sqlDateTime(now);
}

function sqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
