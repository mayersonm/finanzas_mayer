import { auth, route } from '../router.js';
import { health, systemHealth } from '../../modules/system/health.js';
import { exchangeRate } from '../../modules/system/exchange-rate.js';

export const systemRoutes = [
  route('GET', '/', auth.public, (ctx) => health(ctx.env)),
  route('GET', '/health', auth.public, (ctx) => health(ctx.env)),
  route('GET', '/api/system-health', auth.dash, (ctx) => systemHealth(ctx.env)),
  route('GET', '/api/exchange-rate', auth.dash, (ctx) => exchangeRate(ctx.env)),
];
