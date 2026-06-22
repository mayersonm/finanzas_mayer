import { auth, route } from '../router.js';
import { upsertBudgetFromPayload } from '../../modules/budgeting/service.js';

export const budgetingRoutes = [
  route('POST', '/api/budgets', auth.dashAdmin, async (ctx) => upsertBudgetFromPayload(ctx.env, await ctx.body(), ctx.query), 201),
];
