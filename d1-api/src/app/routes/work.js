import { requireDashboardAccess } from '../../auth/service.js';
import { json, safeJson } from '../../shared/http.js';
import {
  createWorkItem,
  addWorkItemTimelineEvent,
  deleteWorkItem,
  listWorkItems,
  reorderWorkItems,
  updateWorkItem,
} from '../../modules/work/service.js';

export async function workRoutes(request, env, url) {
  const timelineMatch = url.pathname.match(/^\/api\/work-items\/([^/]+)\/timeline$/);
  const itemMatch = url.pathname.match(/^\/api\/work-items\/([^/]+)$/);

  if (url.pathname === '/api/work-items' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await listWorkItems(env, url.searchParams));
  }

  if (url.pathname === '/api/work-items' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await createWorkItem(env, await safeJson(request), url.searchParams), 201);
  }

  if (url.pathname === '/api/work-items/reorder' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await reorderWorkItems(env, await safeJson(request), url.searchParams));
  }

  if (timelineMatch && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await addWorkItemTimelineEvent(env, decodeURIComponent(timelineMatch[1]), await safeJson(request), url.searchParams), 201);
  }

  if (itemMatch && request.method === 'PATCH') {
    await requireDashboardAccess(request, env);
    return json(await updateWorkItem(env, decodeURIComponent(itemMatch[1]), await safeJson(request), url.searchParams));
  }

  if (itemMatch && request.method === 'DELETE') {
    await requireDashboardAccess(request, env);
    return json(await deleteWorkItem(env, decodeURIComponent(itemMatch[1]), url.searchParams));
  }

  return null;
}
