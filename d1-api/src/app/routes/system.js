
import { json } from '../../shared/http.js';
import { requireDashboardAccess } from '../../auth/service.js';
import { health, systemHealth } from '../../modules/system/health.js';
import { exchangeRate } from '../../modules/system/exchange-rate.js';

export async function systemRoutes(request, env, url) {
  if ((url.pathname === '/' || url.pathname === '/health') && request.method === 'GET') {
    return json(await health(env));
  }

  if (url.pathname === '/api/system-health' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await systemHealth(env));
  }

  if (url.pathname === '/api/exchange-rate' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await exchangeRate(env));
  }

  return null;
}
