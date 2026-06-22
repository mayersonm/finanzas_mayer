import { auth, route } from '../router.js';
import { syncFromGas } from '../../modules/sync/service.js';

export const syncRoutes = [
  route('POST', '/api/sync', auth.dash, (ctx) => syncFromGas(ctx.env, ctx.query)),
  route('POST', '/api/sync/gas', auth.admin, (ctx) => syncFromGas(ctx.env, ctx.query)),
];
