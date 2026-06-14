import { json } from '../../shared/http.js';
import {
  changePassword,
  disableTwoFactor,
  enableTwoFactor,
  login,
  requireDashboardAccess,
  setupTwoFactor,
  twoFactorStatus,
  verifyTwoFactorLogin,
} from '../../auth/service.js';

export async function authRoutes(request, env, url) {
  if (url.pathname === '/api/login' && request.method === 'POST') {
    return json(await login(env, await request.json()));
  }

  if (url.pathname === '/api/login/2fa' && request.method === 'POST') {
    return json(await verifyTwoFactorLogin(env, await request.json()));
  }

  if (url.pathname === '/api/session' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json({ ok: true, authenticated: true });
  }

  if (url.pathname === '/api/logout' && request.method === 'POST') {
    return json({ ok: true });
  }

  if (url.pathname === '/api/password' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await changePassword(env, await request.json()));
  }

  if (url.pathname === '/api/2fa/status' && request.method === 'GET') {
    await requireDashboardAccess(request, env);
    return json(await twoFactorStatus(env));
  }

  if (url.pathname === '/api/2fa/setup' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await setupTwoFactor(env));
  }

  if (url.pathname === '/api/2fa/enable' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await enableTwoFactor(env, await request.json()));
  }

  if (url.pathname === '/api/2fa/disable' && request.method === 'POST') {
    await requireDashboardAccess(request, env);
    return json(await disableTwoFactor(env, await request.json()));
  }

  return null;
}
