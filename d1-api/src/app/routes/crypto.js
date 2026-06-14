import { json } from '../../shared/http.js';
import { requireDashboardAccess } from '../../auth/service.js';
import {
  createCryptoAlert,
  createCryptoOperation,
  cryptoPortfolio,
  deleteCryptoAlert,
  deleteCryptoOperation,
} from '../../modules/investments/crypto.js';

export async function cryptoRoutes(request, env, url) {
  const cryptoOperationMatch = url.pathname.match(/^\/api\/crypto\/operations\/([^/]+)$/);
  const cryptoAlertMatch = url.pathname.match(/^\/api\/crypto\/alerts\/([^/]+)$/);

  if (url.pathname === '/api/crypto' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await cryptoPortfolio(env, url.searchParams));
  }

  if (url.pathname === '/api/crypto/operations' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await createCryptoOperation(env, await request.json(), url.searchParams), 201);
  }

  if (cryptoOperationMatch && request.method === 'DELETE') {
    await requireDashboardAccess(request, env);
    return json(await deleteCryptoOperation(env, decodeURIComponent(cryptoOperationMatch[1]), url.searchParams));
  }

  if (url.pathname === '/api/crypto/alerts' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await createCryptoAlert(env, await request.json(), url.searchParams), 201);
  }

  if (cryptoAlertMatch && request.method === 'DELETE') {
    await requireDashboardAccess(request, env);
    return json(await deleteCryptoAlert(env, decodeURIComponent(cryptoAlertMatch[1]), url.searchParams));
  }

  return null;
}
