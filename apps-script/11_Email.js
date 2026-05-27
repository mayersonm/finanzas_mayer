// ---- RESUMEN DIARIO POR CORREO -----------------------------

function enviarResumenDiarioEmail() {
  const props = PropertiesService.getScriptProperties();
  const emailTo = getEmailTo_('daily');
  const chatId = props.getProperty('dashboard_chat_id') || '1538086276';

  const resumen = construirResumenDiarioEmail_(chatId);

  MailApp.sendEmail({
    to: emailTo,
    subject: resumen.subject,
    body: resumen.textBody,
    htmlBody: resumen.htmlBody,
    attachments: [resumen.excelBlob],
    name: 'Finanzas Mayeson',
  });

  Logger.log('Resumen diario enviado a ' + emailTo);
  return 'Resumen diario enviado a ' + emailTo;
}

function testEnviarResumenDiarioEmail() {
  enviarResumenDiarioEmail();
}

function enviarResumenMensualEmail() {
  const periodo = periodoPagoCerradoEmail_(new Date());
  return enviarResumenMensualEmailPeriodo_(periodo, 'cierre');
}

function resumenMensualAutomatico() {
  const now = new Date();
  const dia = Number(Utilities.formatDate(now, 'America/Lima', 'd'));
  if (dia !== 23) {
    return 'No corresponde resumen mensual hoy';
  }

  const periodo = periodoPagoCerradoEmail_(now);
  const periodoKey = periodo.key;
  const props = PropertiesService.getScriptProperties();
  const sentKey = 'monthly_email_sent_' + periodoKey;

  if (props.getProperty(sentKey)) {
    Logger.log('Resumen mensual ya enviado para ' + periodoKey);
    return 'Resumen mensual ya enviado para ' + periodoKey;
  }

  const result = enviarResumenMensualEmailPeriodo_(periodo, 'automatico');
  props.setProperty(sentKey, Utilities.formatDate(new Date(), 'America/Lima', "yyyy-MM-dd'T'HH:mm:ss"));
  return result;
}

function enviarResumenMensualSiCorrespondeEmail() {
  const dia = Number(Utilities.formatDate(new Date(), 'America/Lima', 'd'));
  if (dia !== 23) {
    return 'No corresponde resumen mensual hoy';
  }

  return resumenMensualAutomatico();
}

function testEnviarResumenMensualEmail() {
  return enviarResumenMensualEmailPeriodo_(periodoPagoEmail_(new Date()), 'prueba');
}

function enviarResumenAnualEmail() {
  const year = Number(Utilities.formatDate(new Date(), 'America/Lima', 'yyyy')) - 1;
  return enviarResumenAnualEmailAnio_(year, 'cierre');
}

function resumenAnualAutomatico() {
  const now = new Date();
  const month = Utilities.formatDate(now, 'America/Lima', 'MM');
  if (month !== '01') {
    return 'No corresponde resumen anual este mes';
  }

  const year = Number(Utilities.formatDate(now, 'America/Lima', 'yyyy')) - 1;
  const props = PropertiesService.getScriptProperties();
  const sentKey = 'yearly_email_sent_' + year;

  if (props.getProperty(sentKey)) {
    Logger.log('Resumen anual ya enviado para ' + year);
    return 'Resumen anual ya enviado para ' + year;
  }

  const result = enviarResumenAnualEmailAnio_(year, 'automatico');
  props.setProperty(sentKey, Utilities.formatDate(now, 'America/Lima', "yyyy-MM-dd'T'HH:mm:ss"));
  return result;
}

function testEnviarResumenAnualEmail() {
  const year = Number(Utilities.formatDate(new Date(), 'America/Lima', 'yyyy'));
  return enviarResumenAnualEmailAnio_(year, 'prueba');
}

function cmdResumenAnualEmail(chatId) {
  sendMessage(chatId, 'Generando resumen anual por correo...', true);

  try {
    const year = Number(Utilities.formatDate(new Date(), 'America/Lima', 'yyyy'));
    const result = enviarResumenAnualEmailAnio_(year, 'prueba', chatId);
    sendMessage(chatId, result + '\nRevisa tu correo.', true);
  } catch (e) {
    Logger.log('Error cmdResumenAnualEmail: ' + e.toString());
    sendMessage(chatId, 'No pude generar el resumen anual. Revisa los logs de Apps Script.', true);
  }
}

function cmdCorreo(chatId, text) {
  if (!puedeConfigurarCorreo_(chatId)) {
    return sendMessage(chatId, 'No tienes permiso para cambiar la configuracion de correo.', true);
  }

  const clean = String(text || '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return sendEmailConfig_(chatId);
  }

  const rawScope = String(parts[1] || '').toLowerCase();
  const scopes = ['diario', 'mensual', 'anual', 'todos'];
  const hasScope = scopes.indexOf(rawScope) >= 0;
  const scope = hasScope ? rawScope : 'todos';
  const email = hasScope ? parts[2] : parts[1];

  if (!isValidEmail_(email)) {
    return sendMessage(chatId,
      'Formato de correo no valido.\n\n' +
      '*Ejemplos:*\n' +
      '• `correo tu@email.com`\n' +
      '• `correo diario tu@email.com`\n' +
      '• `correo mensual tu@email.com`\n' +
      '• `correo anual tu@email.com`',
      true
    );
  }

  guardarEmailConfig_(scope, email);

  return sendMessage(chatId,
    `✅ *Correo actualizado*\n\n` +
    `📬 Destino: \`${email.toLowerCase()}\`\n` +
    `⚙️ Alcance: *${emailScopeLabel_(scope)}*`,
    true
  );
}

function sendEmailConfig_(chatId) {
  const config = obtenerEmailConfig_();

  return sendMessage(chatId,
    `📬 *Correos configurados*\n\n` +
    `• Diario: ${fmtEmailConfigLine_(config.daily)}\n` +
    `• Mensual: ${fmtEmailConfigLine_(config.monthly)}\n` +
    `• Anual: ${fmtEmailConfigLine_(config.yearly)}\n\n` +
    `Para cambiar todo:\n` +
    '`correo tu@email.com`\n\n' +
    `Para cambiar uno:\n` +
    '`correo mensual tu@email.com`',
    true
  );
}

function obtenerEmailConfig_() {
  const props = PropertiesService.getScriptProperties();
  const base = props.getProperty('finance_email_to') || '';
  const daily = props.getProperty('daily_email_to') || base;
  const monthly = props.getProperty('monthly_email_to') || daily;
  const yearly = props.getProperty('yearly_email_to') || monthly;

  return {
    base: base,
    daily: daily,
    monthly: monthly,
    yearly: yearly,
  };
}

function getEmailTo_(type) {
  const config = obtenerEmailConfig_();
  const email = config[type] || config.daily || config.base;

  if (!email) {
    throw new Error('No hay correo configurado. En Telegram escribe: correo tu@email.com');
  }

  return email;
}

function guardarEmailConfig_(scope, email) {
  const props = PropertiesService.getScriptProperties();
  const value = String(email || '').trim().toLowerCase();

  if (scope === 'todos') {
    props.setProperty('finance_email_to', value);
    props.setProperty('daily_email_to', value);
    props.setProperty('monthly_email_to', value);
    props.setProperty('yearly_email_to', value);
    return;
  }

  if (scope === 'diario') props.setProperty('daily_email_to', value);
  if (scope === 'mensual') props.setProperty('monthly_email_to', value);
  if (scope === 'anual') props.setProperty('yearly_email_to', value);
}

function puedeConfigurarCorreo_(chatId) {
  const ownerChatId = PropertiesService.getScriptProperties().getProperty('dashboard_chat_id');
  return !ownerChatId || String(chatId) === String(ownerChatId);
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function fmtEmailConfigLine_(email) {
  return email ? '`' + String(email).toLowerCase() + '`' : '_sin configurar_';
}

function emailScopeLabel_(scope) {
  if (scope === 'diario') return 'Resumen diario';
  if (scope === 'mensual') return 'Resumen mensual';
  if (scope === 'anual') return 'Resumen anual';
  return 'Todos los reportes';
}

