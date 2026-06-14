import { gasConfigRequest } from './gas.js';

export async function health(env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM transactions').first();
  const fixed = await env.DB.prepare('SELECT COUNT(*) AS total FROM fixed_expenses WHERE active = 1').first();
  const receipts = await env.DB.prepare('SELECT COUNT(*) AS total FROM receipts').first();
  const debts = await env.DB.prepare("SELECT COUNT(*) AS total FROM debts WHERE status = 'activa'").first();

  return {
    ok: true,
    database: 'finanzas_mayeson',
    transactions: row?.total || 0,
    fixedExpenses: fixed?.total || 0,
    receipts: receipts?.total || 0,
    debts: debts?.total || 0,
    checkedAt: new Date().toISOString(),
  };
}

export async function systemHealth(env) {
  const checks = [];
  const started = Date.now();
  const dbInfo = await health(env);

  checks.push({
    id: 'worker',
    label: 'Cloudflare Worker',
    status: 'ok',
    message: 'Worker activo y respondiendo.',
  });

  checks.push({
    id: 'd1',
    label: 'D1',
    status: 'ok',
    message: `${dbInfo.transactions} movimientos, ${dbInfo.receipts} recibos, ${dbInfo.debts} deudas.`,
  });

  checks.push({
    id: 'r2',
    label: 'R2 recibos',
    status: env.RECEIPTS_BUCKET ? 'ok' : 'error',
    message: env.RECEIPTS_BUCKET ? 'Binding RECEIPTS_BUCKET disponible.' : 'Falta binding RECEIPTS_BUCKET.',
  });

  [
    ['dashboardApiKey', 'DASHBOARD_API_KEY', env.DASHBOARD_API_KEY, 'error'],
    ['gasApiUrl', 'GAS_API_URL', env.GAS_API_URL],
    ['gasApiKey', 'GAS_API_KEY', env.GAS_API_KEY],
    ['adminKey', 'ADMIN_KEY', env.ADMIN_KEY],
    ['defaultChatId', 'DEFAULT_CHAT_ID', env.DEFAULT_CHAT_ID],
    ['sessionSecret', 'SESSION_SECRET', env.SESSION_SECRET],
  ].forEach(([id, label, value, missingStatus = 'error']) => {
    checks.push({
      id,
      label,
      status: value ? 'ok' : missingStatus,
      message: value ? 'Configurado.' : missingStatus === 'warning' ? 'Opcional si el dashboard no usa login.' : 'Falta configurar este secreto en Worker.',
    });
  });

  let gasHealth = null;
  if (env.GAS_API_URL && env.GAS_API_KEY) {
    try {
      gasHealth = await gasConfigRequest(env, 'health');
      checks.push({
        id: 'appsScript',
        label: 'Apps Script',
        status: 'ok',
        message: gasHealth.spreadsheetName ? `Conectado a ${gasHealth.spreadsheetName}.` : 'Apps Script responde.',
      });

      Object.entries(gasHealth.sheets || {}).forEach(([name, exists]) => {
        checks.push({
          id: `sheet:${name}`,
          label: `Sheet ${name}`,
          status: exists ? 'ok' : 'warning',
          message: exists ? 'Pestana encontrada.' : 'No existe todavia o no fue inicializada.',
        });
      });

      Object.entries(gasHealth.services || {}).forEach(([name, exists]) => {
        checks.push({
          id: `gas:${name}`,
          label: serviceLabel(name),
          status: exists ? 'ok' : 'warning',
          message: exists ? 'Configurado en Apps Script.' : 'Falta en Script Properties.',
        });
      });
    } catch (error) {
      checks.push({
        id: 'appsScript',
        label: 'Apps Script',
        status: 'error',
        message: error.message || 'No se pudo consultar Apps Script.',
      });
    }
  } else {
    checks.push({
      id: 'appsScript',
      label: 'Apps Script',
      status: 'error',
      message: 'Faltan GAS_API_URL o GAS_API_KEY en Worker.',
    });
  }

  const errors = checks.filter((item) => item.status === 'error').length;
  const warnings = checks.filter((item) => item.status === 'warning').length;

  return {
    ok: errors === 0,
    status: errors ? 'error' : warnings ? 'warning' : 'ok',
    summary: {
      total: checks.length,
      ok: checks.filter((item) => item.status === 'ok').length,
      warnings,
      errors,
      latencyMs: Date.now() - started,
    },
    checks,
    gasHealth,
    checkedAt: new Date().toISOString(),
  };
}

export function serviceLabel(name) {
  const labels = {
    telegramToken: 'Telegram token',
    workerUrl: 'Worker URL',
    claudeApiKey: 'IA API key',
    d1ApiUrl: 'D1 API URL',
    d1AdminKey: 'D1 admin key',
  };
  return labels[name] || name;
}
