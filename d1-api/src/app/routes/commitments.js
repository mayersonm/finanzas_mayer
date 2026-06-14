
import { json } from '../../shared/http.js';
import { requireDashboardAccess, requireDashboardOrAdminAccess } from '../../auth/service.js';
import { deleteDebt, addDebtPayment, updateDebtFromDashboard, upsertDebtFromPayload } from '../../modules/commitments/debts.js';
import { deleteFixedExpense, setFixedExpenseMonthStatus, updateFixedExpenseFromDashboard, upsertFixedExpenseFromPayload } from '../../modules/commitments/fixed-expenses.js';

export async function commitmentsRoutes(request, env, url) {
  const fixedExpenseMatch = url.pathname.match(/^\/api\/fixed-expenses\/([^/]+)$/);
  const fixedExpenseStatusMatch = url.pathname.match(/^\/api\/fixed-expenses\/([^/]+)\/status$/);
  const debtMatch = url.pathname.match(/^\/api\/debts\/([^/]+)$/);
  const debtPaymentMatch = url.pathname.match(/^\/api\/debts\/([^/]+)\/payments$/);

  if (url.pathname === '/api/fixed-expenses' && request.method === 'POST') {
    await requireDashboardOrAdminAccess(request, env);
    return json(await upsertFixedExpenseFromPayload(env, await request.json(), url.searchParams), 201);
  }

  if (fixedExpenseMatch && request.method === 'PATCH') {
    await requireDashboardAccess(request, env);
    return json(await updateFixedExpenseFromDashboard(env, decodeURIComponent(fixedExpenseMatch[1]), await request.json(), url.searchParams));
  }

  if (fixedExpenseMatch && request.method === 'DELETE') {
    await requireDashboardOrAdminAccess(request, env);
    return json(await deleteFixedExpense(env, decodeURIComponent(fixedExpenseMatch[1]), url.searchParams));
  }

  if (fixedExpenseStatusMatch && request.method === 'POST') {
    await requireDashboardOrAdminAccess(request, env);
    return json(await setFixedExpenseMonthStatus(env, decodeURIComponent(fixedExpenseStatusMatch[1]), await request.json(), url.searchParams));
  }

  if (url.pathname === '/api/debts' && request.method === 'POST') {
    await requireDashboardOrAdminAccess(request, env);
    return json(await upsertDebtFromPayload(env, await request.json()), 201);
  }

  if (debtMatch && request.method === 'PATCH') {
    await requireDashboardAccess(request, env);
    return json(await updateDebtFromDashboard(env, decodeURIComponent(debtMatch[1]), await request.json(), url.searchParams));
  }

  if (debtMatch && request.method === 'DELETE') {
    await requireDashboardAccess(request, env);
    return json(await deleteDebt(env, decodeURIComponent(debtMatch[1]), url.searchParams));
  }

  if (debtPaymentMatch && request.method === 'POST') {
    await requireDashboardOrAdminAccess(request, env);
    return json(await addDebtPayment(env, decodeURIComponent(debtPaymentMatch[1]), await request.json(), url.searchParams), 201);
  }

  return null;
}
