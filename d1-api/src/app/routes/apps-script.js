import { json } from '../../shared/http.js';
import { requireDashboardAccess } from '../../auth/service.js';
import { gasConfigRequest } from '../../modules/system/gas.js';

export async function appsScriptRoutes(request, env, url) {
  if (url.pathname === '/api/apps-script/setup-triggers' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await gasConfigRequest(env, 'setup_triggers'));
  }

  if (url.pathname === '/api/apps-script/send-daily-email' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await gasConfigRequest(env, 'send_daily_email'));
  }

  if (url.pathname === '/api/apps-script/send-monthly-email' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await gasConfigRequest(env, 'send_monthly_email', url.searchParams));
  }

  if (url.pathname === '/api/apps-script/send-yearly-email' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await gasConfigRequest(env, 'send_yearly_email', url.searchParams));
  }

  if (url.pathname === '/api/apps-script/send-daily-telegram' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await gasConfigRequest(env, 'send_daily_telegram', url.searchParams));
  }

  return null;
}
