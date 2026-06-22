import { auth, route } from '../router.js';
import {
  addDebtPayment,
  deleteDebt,
  updateDebtFromDashboard,
  upsertDebtFromPayload,
} from '../../modules/commitments/debts.js';
import {
  deleteFixedExpense,
  setFixedExpenseMonthStatus,
  updateFixedExpenseFromDashboard,
  upsertFixedExpenseFromPayload,
} from '../../modules/commitments/fixed-expenses.js';

export const commitmentsRoutes = [
  route('POST', '/api/fixed-expenses', auth.dashAdmin, async (ctx) => upsertFixedExpenseFromPayload(ctx.env, await ctx.body(), ctx.query), 201),
  route('POST', '/api/fixed-expenses/:id/status', auth.dashAdmin, async (ctx) => setFixedExpenseMonthStatus(ctx.env, ctx.params.id, await ctx.body(), ctx.query)),
  route('PATCH', '/api/fixed-expenses/:id', auth.dash, async (ctx) => updateFixedExpenseFromDashboard(ctx.env, ctx.params.id, await ctx.body(), ctx.query)),
  route('DELETE', '/api/fixed-expenses/:id', auth.dashAdmin, (ctx) => deleteFixedExpense(ctx.env, ctx.params.id, ctx.query)),
  route('POST', '/api/debts', auth.dashAdmin, async (ctx) => upsertDebtFromPayload(ctx.env, await ctx.body()), 201),
  route('POST', '/api/debts/:id/payments', auth.dashAdmin, async (ctx) => addDebtPayment(ctx.env, ctx.params.id, await ctx.body(), ctx.query), 201),
  route('PATCH', '/api/debts/:id', auth.dash, async (ctx) => updateDebtFromDashboard(ctx.env, ctx.params.id, await ctx.body(), ctx.query)),
  route('DELETE', '/api/debts/:id', auth.dash, (ctx) => deleteDebt(ctx.env, ctx.params.id, ctx.query)),
];
