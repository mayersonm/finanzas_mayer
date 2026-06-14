import { json } from '../../shared/http.js';
import { requireDashboardAccess } from '../../auth/service.js';
import {
  deleteInvestment,
  investmentsList,
  updateInvestmentFromDashboard,
  upsertInvestmentFromDashboard,
} from '../../modules/investments/service.js';

export async function investmentsRoutes(request, env, url) {
  const investmentMatch = url.pathname.match(/^\/api\/investments\/([^/]+)$/);

  if (url.pathname === '/api/investments' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await investmentsList(env, url.searchParams));
  }

  if (url.pathname === '/api/investments' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await upsertInvestmentFromDashboard(env, await request.json(), url.searchParams), 201);
  }

  if (investmentMatch && request.method === 'PATCH') {
    await requireDashboardAccess(request, env);
    return json(await updateInvestmentFromDashboard(env, decodeURIComponent(investmentMatch[1]), await request.json(), url.searchParams));
  }

  if (investmentMatch && request.method === 'DELETE') {
    await requireDashboardAccess(request, env);
    return json(await deleteInvestment(env, decodeURIComponent(investmentMatch[1]), url.searchParams));
  }

  return null;
}
