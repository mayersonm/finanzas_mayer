// ============================================================ \\
//  BOT DE FINANZAS PERSONALES — MAYESON                        \\
//  Stack: Telegram Bot + Google Apps Script + Google Sheets    \\
//  100% gratuito y personal                                    \\
// ============================================================ \\

// Configura estos valores en Apps Script > Project Settings > Script Properties:
// telegram_bot_token, webapp_url, sheet_id, worker_url
const TOKEN      = getRequiredScriptProperty_('telegram_bot_token');
const WEBAPP_URL = getRequiredScriptProperty_('webapp_url');
const SHEET_ID   = getRequiredScriptProperty_('sheet_id');
const WORKER_URL = getRequiredScriptProperty_('worker_url');

const CATS_GASTO   = ['comida','transporte','servicios','entretenimiento','salud','ropa','educacion','otro'];
const CATS_INGRESO = ['salario','freelance','inversion','venta','otro'];

function getRequiredScriptProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error('Falta Script Property: ' + name);
  return value;
}
