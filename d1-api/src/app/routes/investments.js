import { auth, route } from '../router.js';
import {
  deleteInvestment,
  investmentsList,
  updateInvestmentFromDashboard,
  upsertInvestmentFromDashboard,
} from '../../modules/investments/service.js';

export const investmentsRoutes = [
  route('GET', '/api/investments', auth.dash, (ctx) => investmentsList(ctx.env, ctx.query)),
  route('POST', '/api/investments', auth.dash, async (ctx) => upsertInvestmentFromDashboard(ctx.env, await ctx.body(), ctx.query), 201),
  route('PATCH', '/api/investments/:id', auth.dash, async (ctx) => updateInvestmentFromDashboard(ctx.env, ctx.params.id, await ctx.body(), ctx.query)),
  route('DELETE', '/api/investments/:id', auth.dash, (ctx) => deleteInvestment(ctx.env, ctx.params.id, ctx.query)),
];
