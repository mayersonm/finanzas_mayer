import { json } from '../../shared/http.js';
import { auth, route } from '../router.js';
import { logReceiptError, receiptFile, uploadReceipt } from '../../modules/receipts/service.js';

export const receiptsRoutes = [
  route('POST', '/api/receipts', auth.admin, async (ctx) => {
    const payload = await ctx.safeBody();
    try {
      return json(await uploadReceipt(ctx.env, payload), 201);
    } catch (error) {
      await logReceiptError(ctx.env, payload, 'api_receipts', error);
      throw error;
    }
  }),
  route('GET', '/api/receipts/:id/file', auth.dash, (ctx) => receiptFile(ctx.env, ctx.params.id)),
];
