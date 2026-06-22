import { json } from '../../shared/http.js';
import { auth, route } from '../router.js';
import { aiAdvisor, bootstrap, calendarOnly, dashboard } from '../../modules/dashboard/service.js';
import { financialClosures, saveFinancialClosure } from '../../modules/closures/service.js';
import { netWorth, saveNetWorthSnapshot } from '../../modules/net-worth/service.js';

export const dashboardRoutes = [
  route('GET', '/api/calendar', auth.dash, (ctx) => calendarOnly(ctx.env, ctx.query)),
  route('GET', '/api/bootstrap', auth.dash, (ctx) => bootstrap(ctx.env, ctx.query)),
  route('GET', '/api/dashboard', auth.dashAdmin, (ctx) => dashboard(ctx.env, ctx.query)),
  route('POST', '/api/ai/advisor', auth.dash, async (ctx) => aiAdvisor(ctx.env, ctx.query, await ctx.safeBody())),
  route('GET', '/api/net-worth', auth.dash, (ctx) => netWorth(ctx.env, ctx.query)),
  route('POST', '/api/net-worth/snapshot', auth.dash, (ctx) => saveNetWorthSnapshot(ctx.env, ctx.query), 201),
  route('GET', '/api/closures', auth.dash, (ctx) => financialClosures(ctx.env, ctx.query)),
  route('POST', '/api/closures', auth.dash, async (ctx) => {
    const payload = await ctx.safeBody();
    return json(await saveFinancialClosure(ctx.env, ctx.query, payload), payload?.dryRun ? 200 : 201);
  }),
];
