
import { json } from '../../shared/http.js';
import { getChatId } from '../../shared/request.js';
import { requireAdminKey, requireDashboardAccess, requireDashboardOrAdminAccess } from '../../auth/service.js';
import { deleteTransaction, insertTransaction, transactions, updateTransactionCategory, updateTransactionFromDashboard, updateTransactionPayment } from '../../modules/transactions/service.js';

export async function transactionsRoutes(request, env, url) {
  const transactionMatch = url.pathname.match(/^\/api\/transactions\/([^/]+)$/);

  if (url.pathname === '/api/transactions' && request.method === 'GET') {
    await requireDashboardOrAdminAccess(request, env);
    return json(await transactions(env, url.searchParams));
  }

  if (url.pathname === '/api/transactions' && request.method === 'POST') {
    requireAdminKey(request, env);
    return json(await insertTransaction(env, await request.json()), 201);
  }

  if (transactionMatch && request.method === 'DELETE') {
    await requireDashboardAccess(request, env);
    return json(await deleteTransaction(env, {
      id: decodeURIComponent(transactionMatch[1]),
      chatId: getChatId(env, url.searchParams),
      deleteFromGas: true,
    }));
  }

  if (transactionMatch && request.method === 'PATCH') {
    await requireDashboardAccess(request, env);
    return json(await updateTransactionFromDashboard(env, decodeURIComponent(transactionMatch[1]), await request.json(), url.searchParams));
  }

  if (url.pathname === '/api/transactions/delete' && request.method === 'POST') {
    requireAdminKey(request, env);
    const payload = await request.json();
    return json(await deleteTransaction(env, {
      id: String(payload.id || payload.transaction_id || payload.transactionId || '').trim(),
      chatId: String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim(),
      deleteFromGas: false,
    }));
  }

  if (url.pathname === '/api/transactions/category' && request.method === 'POST') {
    requireAdminKey(request, env);
    return json(await updateTransactionCategory(env, await request.json()));
  }

  if (url.pathname === '/api/transactions/payment' && request.method === 'POST') {
    requireAdminKey(request, env);
    return json(await updateTransactionPayment(env, await request.json()));
  }

  return null;
}
