import { json } from '../../shared/http.js';
import { requireAdminKey, requireDashboardAccess } from '../../auth/service.js';
import {
  categoryDefinitions,
  dashboardSettings,
  disableCategoryDefinition,
  linkTelegramUser,
  profile,
  updateDashboardSettings,
  upsertCategoryDefinition,
  usersList,
} from '../../modules/settings/service.js';

export async function settingsRoutes(request, env, url) {
  if (url.pathname === '/api/settings' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await dashboardSettings(env, url.searchParams));
  }

  if (url.pathname === '/api/settings' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await updateDashboardSettings(env, await request.json(), url.searchParams));
  }

  if (url.pathname === '/api/profile' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await profile(env, url.searchParams));
  }

  if (url.pathname === '/api/categories' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await categoryDefinitions(env, url.searchParams));
  }

  if (url.pathname === '/api/categories' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await upsertCategoryDefinition(env, await request.json(), url.searchParams), 201);
  }

  if (url.pathname === '/api/categories/delete' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await disableCategoryDefinition(env, await request.json(), url.searchParams));
  }

  if (url.pathname === '/api/users' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await usersList(env));
  }

  if (url.pathname === '/api/users/link' && request.method === 'POST') {
    requireAdminKey(request, env);
    return json(await linkTelegramUser(env, await request.json()), 201);
  }

  return null;
}
