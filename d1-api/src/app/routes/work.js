import { requireDashboardAccess } from '../../auth/service.js';
import { json, safeJson } from '../../shared/http.js';
import {
  createWorkFollowup,
  createWorkMeeting,
  deleteWorkFollowup,
  deleteWorkMeeting,
  listWorkMeetings,
  updateWorkFollowup,
  updateWorkMeeting,
} from '../../modules/work/meetings.js';
import {
  createWorkItem,
  addWorkItemTimelineEvent,
  deleteWorkItem,
  listWorkItems,
  reorderWorkItems,
  updateWorkItem,
} from '../../modules/work/service.js';

export async function workRoutes(request, env, url) {
  const followupMatch = url.pathname.match(/^\/api\/work-followups\/([^/]+)$/);
  const meetingMatch = url.pathname.match(/^\/api\/work-meetings\/([^/]+)$/);
  const timelineMatch = url.pathname.match(/^\/api\/work-items\/([^/]+)\/timeline$/);
  const itemMatch = url.pathname.match(/^\/api\/work-items\/([^/]+)$/);

  if (url.pathname === '/api/work-meetings' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await listWorkMeetings(env, url.searchParams));
  }

  if (url.pathname === '/api/work-meetings' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await createWorkMeeting(env, await safeJson(request), url.searchParams), 201);
  }

  if (url.pathname === '/api/work-followups' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await createWorkFollowup(env, await safeJson(request), url.searchParams), 201);
  }

  if (meetingMatch && request.method === 'PATCH') {
    await requireDashboardAccess(request, env);
    return json(await updateWorkMeeting(env, decodeURIComponent(meetingMatch[1]), await safeJson(request), url.searchParams));
  }

  if (meetingMatch && request.method === 'DELETE') {
    await requireDashboardAccess(request, env);
    return json(await deleteWorkMeeting(env, decodeURIComponent(meetingMatch[1]), url.searchParams));
  }

  if (followupMatch && request.method === 'PATCH') {
    await requireDashboardAccess(request, env);
    return json(await updateWorkFollowup(env, decodeURIComponent(followupMatch[1]), await safeJson(request), url.searchParams));
  }

  if (followupMatch && request.method === 'DELETE') {
    await requireDashboardAccess(request, env);
    return json(await deleteWorkFollowup(env, decodeURIComponent(followupMatch[1]), url.searchParams));
  }

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
