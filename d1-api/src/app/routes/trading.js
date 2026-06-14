import { json, safeJson } from '../../shared/http.js';
import { requireDashboardAccess } from '../../auth/service.js';
import {
  closePaperOrder,
  decideTradingSignal,
  runPaperScalper,
  runTradingBot,
  tradingDashboard,
  upsertTradingStrategy,
} from '../../modules/trading/service.js';

export async function tradingRoutes(request, env, url) {
  const signalDecisionMatch = url.pathname.match(/^\/api\/trading\/signals\/([^/]+)\/decision$/);
  const orderCloseMatch = url.pathname.match(/^\/api\/trading\/orders\/([^/]+)\/close$/);

  if (url.pathname === '/api/trading' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await tradingDashboard(env, url.searchParams));
  }

  if (url.pathname === '/api/trading/run' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await runTradingBot(env, url.searchParams, await safeJson(request)));
  }

  if (url.pathname === '/api/trading/scalper/run' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await runPaperScalper(env, url.searchParams, await safeJson(request)));
  }

  if (url.pathname === '/api/trading/strategy' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await upsertTradingStrategy(env, await safeJson(request), url.searchParams), 201);
  }

  if (signalDecisionMatch && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await decideTradingSignal(env, decodeURIComponent(signalDecisionMatch[1]), await safeJson(request), url.searchParams));
  }

  if (orderCloseMatch && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await closePaperOrder(env, decodeURIComponent(orderCloseMatch[1]), await safeJson(request), url.searchParams));
  }

  return null;
}
