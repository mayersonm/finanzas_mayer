import { auth, route } from '../router.js';
import { getChatId } from '../../shared/request.js';
import {
  clearCashOpening,
  closeCashCycle,
  deleteTransaction,
  insertTransaction,
  transactions,
  updateTransactionCategory,
  updateTransactionFromDashboard,
  updateTransactionPayment,
} from '../../modules/transactions/service.js';

export const transactionsRoutes = [
  route('GET', '/api/transactions', auth.dashAdmin, (ctx) => transactions(ctx.env, ctx.query)),
  route('POST', '/api/cash/close', auth.dash, async (ctx) => closeCashCycle(ctx.env, await ctx.body(), ctx.query)),
  route('POST', '/api/cash/reset', auth.dash, (ctx) => clearCashOpening(ctx.env, getChatId(ctx.env, ctx.query))),
  route('POST', '/api/transactions', auth.admin, async (ctx) => insertTransaction(ctx.env, await ctx.body()), 201),
  route('POST', '/api/transactions/delete', auth.admin, async (ctx) => {
    const payload = await ctx.body();
    return deleteTransaction(ctx.env, {
      id: String(payload.id || payload.transaction_id || payload.transactionId || '').trim(),
      chatId: String(payload.chat_id || payload.chatId || ctx.env.DEFAULT_CHAT_ID || '').trim(),
      deleteFromGas: false,
    });
  }),
  route('POST', '/api/transactions/category', auth.admin, async (ctx) => updateTransactionCategory(ctx.env, await ctx.body())),
  route('POST', '/api/transactions/payment', auth.admin, async (ctx) => updateTransactionPayment(ctx.env, await ctx.body())),
  route('DELETE', '/api/transactions/:id', auth.dash, (ctx) => deleteTransaction(ctx.env, {
    id: ctx.params.id,
    chatId: getChatId(ctx.env, ctx.query),
    deleteFromGas: true,
  })),
  route('PATCH', '/api/transactions/:id', auth.dash, async (ctx) => updateTransactionFromDashboard(ctx.env, ctx.params.id, await ctx.body(), ctx.query)),
];
