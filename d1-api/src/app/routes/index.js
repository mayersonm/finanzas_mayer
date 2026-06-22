import { createRouter } from '../router.js';
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

// Orden de registro = prioridad de match (igual que la cascada anterior).
const routes = [
  ...authRoutes,
  ...settingsRoutes,
  ...systemRoutes,
  ...dashboardRoutes,
  ...rulesRoutes,
  ...syncRoutes,
  ...transactionsRoutes,
  ...budgetingRoutes,
  ...commitmentsRoutes,
  ...receiptsRoutes,
  ...investmentsRoutes,
  ...workRoutes,
  ...appsScriptRoutes,
];

const dispatch = createRouter(routes);

// El worker espera una lista de handlers que devuelven un Response o null.
export const routeHandlers = [dispatch];
