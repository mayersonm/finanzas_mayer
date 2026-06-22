import { auth, route } from '../router.js';
import {
  budgetKeysPayload,
  classifyRulePayload,
  deleteBudgetCategoryRule,
  deleteCategoryRule,
  rulesList,
  upsertBudgetCategoryRule,
  upsertCategoryRule,
} from '../../modules/rules/service.js';

export const rulesRoutes = [
  route('GET', '/api/rules', auth.dashAdmin, (ctx) => rulesList(ctx.env, ctx.query)),
  route('POST', '/api/rules/classify', auth.admin, async (ctx) => classifyRulePayload(ctx.env, await ctx.body())),
  route('POST', '/api/rules/budget/keys', auth.admin, async (ctx) => budgetKeysPayload(ctx.env, await ctx.body())),
  route('POST', '/api/rules/category', auth.dashAdmin, async (ctx) => upsertCategoryRule(ctx.env, await ctx.body()), 201),
  route('POST', '/api/rules/category/delete', auth.dashAdmin, async (ctx) => deleteCategoryRule(ctx.env, await ctx.body())),
  route('POST', '/api/rules/budget', auth.dashAdmin, async (ctx) => upsertBudgetCategoryRule(ctx.env, await ctx.body()), 201),
  route('POST', '/api/rules/budget/delete', auth.dashAdmin, async (ctx) => deleteBudgetCategoryRule(ctx.env, await ctx.body())),
];
