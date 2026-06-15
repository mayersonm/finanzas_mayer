
import { appsScriptRoutes } from './apps-script.js';
import { authRoutes } from './auth.js';
import { budgetingRoutes } from './budgeting.js';
import { commitmentsRoutes } from './commitments.js';
import { dashboardRoutes } from './dashboard.js';
import { investmentsRoutes } from './investments.js';
import { receiptsRoutes } from './receipts.js';
import { rulesRoutes } from './rules.js';
import { settingsRoutes } from './settings.js';
import { syncRoutes } from './sync.js';
import { systemRoutes } from './system.js';
import { transactionsRoutes } from './transactions.js';
import { workRoutes } from './work.js';

export const routeHandlers = [
  authRoutes,
  settingsRoutes,
  systemRoutes,
  dashboardRoutes,
  rulesRoutes,
  syncRoutes,
  transactionsRoutes,
  budgetingRoutes,
  commitmentsRoutes,
  receiptsRoutes,
  investmentsRoutes,
  workRoutes,
  appsScriptRoutes,
];
