
import { json, safeJson } from '../../shared/http.js';
import { requireAdminKey, requireDashboardAccess } from '../../auth/service.js';
import { logReceiptError, receiptFile, uploadReceipt } from '../../modules/receipts/service.js';

export async function receiptsRoutes(request, env, url) {
  const receiptFileMatch = url.pathname.match(/^\/api\/receipts\/([^/]+)\/file$/);

  if (url.pathname === '/api/receipts' && request.method === 'POST') {
    requireAdminKey(request, env);
    const payload = await safeJson(request);
    try {
      return json(await uploadReceipt(env, payload), 201);
    } catch (error) {
      await logReceiptError(env, payload, 'api_receipts', error);
      throw error;
    }
  }

  if (receiptFileMatch && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return receiptFile(env, decodeURIComponent(receiptFileMatch[1]));
  }

  return null;
}
