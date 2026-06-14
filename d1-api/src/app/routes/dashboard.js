
import { json, safeJson } from '../../shared/http.js';
import { requireDashboardAccess, requireDashboardOrAdminAccess } from '../../auth/service.js';
import { aiAdvisor, bootstrap, calendarOnly, dashboard } from '../../modules/dashboard/service.js';
import { financialClosures, saveFinancialClosure } from '../../modules/closures/service.js';
import { netWorth, saveNetWorthSnapshot } from '../../modules/net-worth/service.js';

export async function dashboardRoutes(request, env, url) {
  if (url.pathname === '/api/calendar' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await calendarOnly(env, url.searchParams));
  }

  if (url.pathname === '/api/bootstrap' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await bootstrap(env, url.searchParams));
  }

  if (url.pathname === '/api/dashboard' && request.method === 'GET') {
    await requireDashboardOrAdminAccess(request, env);
    return json(await dashboard(env, url.searchParams));
  }

  if (url.pathname === '/api/ai/advisor' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await aiAdvisor(env, url.searchParams, await safeJson(request)));
  }

  if (url.pathname === '/api/net-worth' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await netWorth(env, url.searchParams));
  }

  if (url.pathname === '/api/net-worth/snapshot' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await saveNetWorthSnapshot(env, url.searchParams), 201);
  }

  if (url.pathname === '/api/closures' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await financialClosures(env, url.searchParams));
  }

  if (url.pathname === '/api/closures' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    const payload = await safeJson(request);
    return json(await saveFinancialClosure(env, url.searchParams, payload), payload?.dryRun ? 200 : 201);
  }

  return null;
}
