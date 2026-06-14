
import { json } from '../../shared/http.js';
import { requireDashboardOrAdminAccess } from '../../auth/service.js';
import { upsertBudgetFromPayload } from '../../modules/budgeting/service.js';

export async function budgetingRoutes(request, env, url) {
  if (url.pathname === '/api/budgets' && request.method === 'POST') {
    await requireDashboardOrAdminAccess(request, env);
    return json(await upsertBudgetFromPayload(env, await request.json(), url.searchParams), 201);
  }

  return null;
}
