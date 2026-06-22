import { auth, route } from '../router.js';
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
  addWorkItemTimelineEvent,
  createWorkItem,
  deleteWorkItem,
  listWorkItems,
  reorderWorkItems,
  updateWorkItem,
} from '../../modules/work/service.js';

export const workRoutes = [
  route('GET', '/api/work-meetings', auth.dash, (ctx) => listWorkMeetings(ctx.env, ctx.query)),
  route('POST', '/api/work-meetings', auth.dash, async (ctx) => createWorkMeeting(ctx.env, await ctx.safeBody(), ctx.query), 201),
  route('PATCH', '/api/work-meetings/:id', auth.dash, async (ctx) => updateWorkMeeting(ctx.env, ctx.params.id, await ctx.safeBody(), ctx.query)),
  route('DELETE', '/api/work-meetings/:id', auth.dash, (ctx) => deleteWorkMeeting(ctx.env, ctx.params.id, ctx.query)),
  route('POST', '/api/work-followups', auth.dash, async (ctx) => createWorkFollowup(ctx.env, await ctx.safeBody(), ctx.query), 201),
  route('PATCH', '/api/work-followups/:id', auth.dash, async (ctx) => updateWorkFollowup(ctx.env, ctx.params.id, await ctx.safeBody(), ctx.query)),
  route('DELETE', '/api/work-followups/:id', auth.dash, (ctx) => deleteWorkFollowup(ctx.env, ctx.params.id, ctx.query)),
  route('GET', '/api/work-items', auth.dash, (ctx) => listWorkItems(ctx.env, ctx.query)),
  route('POST', '/api/work-items', auth.dash, async (ctx) => createWorkItem(ctx.env, await ctx.safeBody(), ctx.query), 201),
  route('POST', '/api/work-items/reorder', auth.dash, async (ctx) => reorderWorkItems(ctx.env, await ctx.safeBody(), ctx.query)),
  route('POST', '/api/work-items/:id/timeline', auth.dash, async (ctx) => addWorkItemTimelineEvent(ctx.env, ctx.params.id, await ctx.safeBody(), ctx.query), 201),
  route('PATCH', '/api/work-items/:id', auth.dash, async (ctx) => updateWorkItem(ctx.env, ctx.params.id, await ctx.safeBody(), ctx.query)),
  route('DELETE', '/api/work-items/:id', auth.dash, (ctx) => deleteWorkItem(ctx.env, ctx.params.id, ctx.query)),
];
