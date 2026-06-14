
import { json } from '../../shared/http.js';
import { requireAdminKey, requireDashboardAccess } from '../../auth/service.js';
import { syncFromGas } from '../../modules/sync/service.js';

export async function syncRoutes(request, env, url) {
  if (url.pathname === '/api/sync' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await syncFromGas(env, url.searchParams));
  }

  if (url.pathname === '/api/sync/gas' && request.method === 'POST') {
    requireAdminKey(request, env);
    return json(await syncFromGas(env, url.searchParams));
  }

  return null;
}
