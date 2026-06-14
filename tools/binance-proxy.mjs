import http from 'node:http';

const host = process.env.BINANCE_PROXY_HOST || '127.0.0.1';
const port = Number(process.env.BINANCE_PROXY_PORT || 8789);
const proxyKey = process.env.BINANCE_PROXY_KEY || '';
const allowedPrefixes = [
  'https://api.binance.com/api/v3/account?',
  'https://api.binance.com/api/v3/ticker/price?',
];

const server = http.createServer(async (request, response) => {
  try {
    const incoming = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
    if (!['/', '/binance'].includes(incoming.pathname)) {
      return send(response, 404, { ok: false, error: 'Not found' });
    }

    const action = incoming.searchParams.get('action') || '';
    const providedKey = incoming.searchParams.get('key') || '';
    const targetUrl = incoming.searchParams.get('url') || '';
    const apiKey = incoming.searchParams.get('apiKey') || '';

    if (action !== 'binance_proxy') return send(response, 400, { ok: false, error: 'Accion no valida' });
    if (proxyKey && providedKey !== proxyKey) return send(response, 401, { ok: false, error: 'Unauthorized' });
    if (!allowedPrefixes.some((prefix) => targetUrl.startsWith(prefix))) {
      return send(response, 400, { ok: false, error: 'URL Binance no permitida' });
    }

    const headers = {
      accept: 'application/json',
      'user-agent': 'FinanzasMayesonLocalProxy/1.0',
    };
    if (apiKey && targetUrl.startsWith(allowedPrefixes[0])) {
      headers['x-mbx-apikey'] = apiKey;
    }

    const binanceResponse = await fetch(targetUrl, { headers });
    const body = await binanceResponse.text();
    return send(response, 200, {
      ok: true,
      status: binanceResponse.status,
      body,
      source: 'local_binance_proxy',
    });
  } catch (error) {
    return send(response, 502, { ok: false, error: error.message || String(error) });
  }
});

server.listen(port, host, () => {
  console.log(`Binance proxy escuchando en http://${host}:${port}`);
});

function send(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}
