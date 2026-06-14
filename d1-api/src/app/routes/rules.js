
import { json } from '../../shared/http.js';
import { requireAdminKey, requireDashboardOrAdminAccess } from '../../auth/service.js';
import { budgetKeysPayload, classifyRulePayload, deleteBudgetCategoryRule, deleteCategoryRule, rulesList, upsertBudgetCategoryRule, upsertCategoryRule } from '../../modules/rules/service.js';

export async function rulesRoutes(request, env, url) {
  if (url.pathname === '/api/rules' && request.method === 'GET') {
    await requireDashboardOrAdminAccess(request, env);
    return json(await rulesList(env, url.searchParams));
  }

  if (url.pathname === '/api/rules/classify' && request.method === 'POST') {
    requireAdminKey(request, env);
    return json(await classifyRulePayload(env, await request.json()));
  }

  if (url.pathname === '/api/rules/budget/keys' && request.method === 'POST') {
    requireAdminKey(request, env);
    return json(await budgetKeysPayload(env, await request.json()));
  }

  if (url.pathname === '/api/rules/category' && request.method === 'POST') {
    await requireDashboardOrAdminAccess(request, env);
    return json(await upsertCategoryRule(env, await request.json()), 201);
  }

  if (url.pathname === '/api/rules/category/delete' && request.method === 'POST') {
    await requireDashboardOrAdminAccess(request, env);
    return json(await deleteCategoryRule(env, await request.json()));
  }

  if (url.pathname === '/api/rules/budget' && request.method === 'POST') {
    await requireDashboardOrAdminAccess(request, env);
    return json(await upsertBudgetCategoryRule(env, await request.json()), 201);
  }

  if (url.pathname === '/api/rules/budget/delete' && request.method === 'POST') {
    await requireDashboardOrAdminAccess(request, env);
    return json(await deleteBudgetCategoryRule(env, await request.json()));
  }

  return null;
}
