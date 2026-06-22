import { auth, route } from '../router.js';
import { gasConfigRequest } from '../../modules/system/gas.js';

export const appsScriptRoutes = [
  route('POST', '/api/apps-script/setup-triggers', auth.dash, (ctx) => gasConfigRequest(ctx.env, 'setup_triggers')),
  route('POST', '/api/apps-script/send-daily-email', auth.dash, (ctx) => gasConfigRequest(ctx.env, 'send_daily_email')),
  route('POST', '/api/apps-script/send-monthly-email', auth.dash, (ctx) => gasConfigRequest(ctx.env, 'send_monthly_email', ctx.query)),
  route('POST', '/api/apps-script/send-yearly-email', auth.dash, (ctx) => gasConfigRequest(ctx.env, 'send_yearly_email', ctx.query)),
  route('POST', '/api/apps-script/send-daily-telegram', auth.dash, (ctx) => gasConfigRequest(ctx.env, 'send_daily_telegram', ctx.query)),
];
