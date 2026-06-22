import { auth, route } from '../router.js';
import {
  changePassword,
  disableTwoFactor,
  enableTwoFactor,
  login,
  setupTwoFactor,
  twoFactorStatus,
  verifyTwoFactorLogin,
} from '../../auth/service.js';

export const authRoutes = [
  route('POST', '/api/login', auth.public, async (ctx) => login(ctx.env, await ctx.body())),
  route('POST', '/api/login/2fa', auth.public, async (ctx) => verifyTwoFactorLogin(ctx.env, await ctx.body())),
  route('GET', '/api/session', auth.dash, () => ({ ok: true, authenticated: true })),
  route('POST', '/api/logout', auth.public, () => ({ ok: true })),
  route('POST', '/api/password', auth.dash, async (ctx) => changePassword(ctx.env, await ctx.body())),
  route('GET', '/api/2fa/status', auth.dash, (ctx) => twoFactorStatus(ctx.env)),
  route('POST', '/api/2fa/setup', auth.dash, (ctx) => setupTwoFactor(ctx.env)),
  route('POST', '/api/2fa/enable', auth.dash, async (ctx) => enableTwoFactor(ctx.env, await ctx.body())),
  route('POST', '/api/2fa/disable', auth.dash, async (ctx) => disableTwoFactor(ctx.env, await ctx.body())),
];
