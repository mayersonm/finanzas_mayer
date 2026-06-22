import { auth, route } from '../router.js';
import {
  categoryDefinitions,
  dashboardSettings,
  disableCategoryDefinition,
  linkTelegramUser,
  profile,
  updateDashboardSettings,
  upsertCategoryDefinition,
  usersList,
} from '../../modules/settings/service.js';

export const settingsRoutes = [
  route('GET', '/api/settings', auth.dash, (ctx) => dashboardSettings(ctx.env, ctx.query)),
  route('POST', '/api/settings', auth.dash, async (ctx) => updateDashboardSettings(ctx.env, await ctx.body(), ctx.query)),
  route('GET', '/api/profile', auth.dash, (ctx) => profile(ctx.env, ctx.query)),
  route('GET', '/api/categories', auth.dash, (ctx) => categoryDefinitions(ctx.env, ctx.query)),
  route('POST', '/api/categories', auth.dash, async (ctx) => upsertCategoryDefinition(ctx.env, await ctx.body(), ctx.query), 201),
  route('POST', '/api/categories/delete', auth.dash, async (ctx) => disableCategoryDefinition(ctx.env, await ctx.body(), ctx.query)),
  route('GET', '/api/users', auth.dash, (ctx) => usersList(ctx.env)),
  route('POST', '/api/users/link', auth.admin, async (ctx) => linkTelegramUser(ctx.env, await ctx.body()), 201),
];
