import http from 'node:http';
import crypto from 'node:crypto';

const port = Number(process.env.PORT || 8080);
const proxyKey = String(process.env.PROXY_KEY || '').trim();
const binanceApiUrl = String(process.env.BINANCE_API_URL || 'https://api.binance.com').trim().replace(/\/+$/g, '');
const binanceApiKey = String(process.env.BINANCE_API_KEY || '').trim();
const binanceApiSecret = String(process.env.BINANCE_API_SECRET || '').trim();
const recvWindow = Number(process.env.BINANCE_RECV_WINDOW || 5000);

const allowedLegacyPrefixes = [
  `${binanceApiUrl}/api/v3/account?`,
  `${binanceApiUrl}/api/v3/ticker/price?`,
  'https://api.binance.com/api/v3/account?',
  'https://api.binance.com/api/v3/ticker/price?',
];

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || `127.0.0.1:${port}`}`);

    if (request.method !== 'GET') {
      return send(response, 405, { ok: false, error: 'Method not allowed' });
    }

    if (url.pathname === '/' && url.searchParams.get('action') === 'binance_proxy') {
      if (!isAuthorized(request, url)) {
        return send(response, 401, { ok: false, error: 'Unauthorized' });
      }
      return await legacyProxy(request, response, url);
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return send(response, 200, {
        ok: true,
        service: 'finanzas-binance-proxy',
        region: process.env.FLY_REGION || '',
        configured: Boolean(proxyKey && binanceApiKey && binanceApiSecret),
        checkedAt: new Date().toISOString(),
      });
    }

    if (!isAuthorized(request, url)) {
      return send(response, 401, { ok: false, error: 'Unauthorized' });
    }

    if (url.pathname === '/api/binance/time') {
      return await proxyJson(response, `${binanceApiUrl}/api/v3/time`, false);
    }

    if (url.pathname === '/api/binance/account') {
      const account = await signedBinanceRequest('/api/v3/account');
      return send(response, 200, {
        ok: true,
        account,
        source: 'fly_binance_proxy',
        updatedAt: new Date().toISOString(),
      });
    }

    if (url.pathname === '/api/binance/ticker') {
      const symbols = parseSymbols(url.searchParams.get('symbols') || url.searchParams.get('pairs') || '');
      const tickerUrl = new URL(`${binanceApiUrl}/api/v3/ticker/price`);
      if (symbols.length) tickerUrl.searchParams.set('symbols', JSON.stringify(symbols));
      return await proxyJson(response, tickerUrl.toString(), false);
    }

    if (url.pathname === '/binance') {
      return await legacyProxy(request, response, url);
    }

    return send(response, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    return send(response, 502, { ok: false, error: friendlyError(error) });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({
    event: 'binance_proxy_started',
    port,
    region: process.env.FLY_REGION || '',
  }));
});

async function legacyProxy(_request, response, url) {
  const action = url.searchParams.get('action') || '';
  const targetUrl = url.searchParams.get('url') || '';
  const apiKey = url.searchParams.get('apiKey') || binanceApiKey;

  if (action !== 'binance_proxy') {
    return send(response, 400, { ok: false, error: 'Accion no valida' });
  }

  if (!allowedLegacyPrefixes.some((prefix) => targetUrl.startsWith(prefix))) {
    return send(response, 400, { ok: false, error: 'URL Binance no permitida' });
  }

  const headers = {
    accept: 'application/json',
    'user-agent': 'FinanzasMayesonFlyProxy/1.0',
  };
  if (apiKey && targetUrl.includes('/api/v3/account?')) {
    headers['x-mbx-apikey'] = apiKey;
  }

  const binanceResponse = await fetchWithTimeout(targetUrl, { headers });
  const body = await binanceResponse.text();
  return send(response, 200, {
    ok: true,
    status: binanceResponse.status,
    body,
    source: 'fly_binance_proxy_legacy',
  });
}

async function signedBinanceRequest(pathname) {
  if (!binanceApiKey || !binanceApiSecret) {
    throw new Error('BINANCE_API_KEY y BINANCE_API_SECRET son requeridos');
  }

  const query = `timestamp=${Date.now()}&recvWindow=${Number.isFinite(recvWindow) ? recvWindow : 5000}`;
  const signature = crypto
    .createHmac('sha256', binanceApiSecret)
    .update(query)
    .digest('hex');
  const targetUrl = `${binanceApiUrl}${pathname}?${query}&signature=${signature}`;

  const response = await fetchWithTimeout(targetUrl, {
    headers: {
      accept: 'application/json',
      'user-agent': 'FinanzasMayesonFlyProxy/1.0',
      'x-mbx-apikey': binanceApiKey,
    },
  });
  const text = await response.text();
  const data = safeJson(text);
  if (!response.ok) {
    throw new Error(data?.msg ? `Binance HTTP ${response.status}: ${data.msg}` : `Binance HTTP ${response.status}`);
  }
  return data;
}

async function proxyJson(response, targetUrl, signed) {
  const headers = {
    accept: 'application/json',
    'user-agent': 'FinanzasMayesonFlyProxy/1.0',
  };
  if (signed) headers['x-mbx-apikey'] = binanceApiKey;

  const binanceResponse = await fetchWithTimeout(targetUrl, { headers });
  const text = await binanceResponse.text();
  const data = safeJson(text);
  if (!binanceResponse.ok) {
    return send(response, binanceResponse.status, {
      ok: false,
      error: data?.msg || text.slice(0, 240),
      status: binanceResponse.status,
    });
  }

  return send(response, 200, {
    ok: true,
    data,
    source: 'fly_binance_proxy',
    updatedAt: new Date().toISOString(),
  });
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isAuthorized(request, url) {
  if (!proxyKey) return false;
  const provided = String(
    headerValue(request, 'x-proxy-key')
      || bearerToken(headerValue(request, 'authorization'))
      || url.searchParams.get('key')
      || '',
  );
  return timingSafeEqual(provided, proxyKey);
}

function headerValue(request, name) {
  const value = request.headers?.[String(name).toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || '');
}

function bearerToken(value) {
  const match = String(value || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseSymbols(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean)
    .map((symbol) => symbol.endsWith('USDT') ? symbol : `${symbol}USDT`)
    .slice(0, 40);
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function friendlyError(error) {
  return String(error?.message || error || 'Error desconocido').slice(0, 500);
}

function send(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}
