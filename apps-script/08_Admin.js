
function checkWebhook() {
  const url = `https://api.telegram.org/bot${TOKEN}/getWebhookInfo`;

  const resp = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true
  });

  const data = JSON.parse(resp.getContentText());

  Logger.log('URL esperada : ' + WORKER_URL);
  Logger.log('URL activa   : ' + (data.result.url || 'NINGUNA'));
  Logger.log('Pendientes   : ' + data.result.pending_update_count);
  Logger.log('Último error : ' + (data.result.last_error_message || 'ninguno'));
}

function limpiarCola() {
  try {
    const url = `https://api.telegram.org/bot${TOKEN}/setWebhook`;

    const payload = {
      url: WORKER_URL,
      drop_pending_updates: true,
      max_connections: 1
    };

    const resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    Logger.log('Webhook Worker registrado y cola limpiada: ' + resp.getContentText());

    checkWebhook();

  } catch (e) {
    Logger.log('Error al limpiar cola: ' + e.toString());
  }
}

function registrarWebhook() {

  const url =
    `https://api.telegram.org/bot${TOKEN}/setWebhook`;

  const payload = {
    url: WORKER_URL,
    drop_pending_updates: true,
    max_connections: 1
  };

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  Logger.log(resp.getContentText());
}



function probarWorkerReal() {
  const payload = {
    update_id: Date.now(),
    message: {
      chat: { id: 'TU_CHAT_ID_REAL' },
      text: 'gasto 1 supermercado prueba worker'
    }
  };

  const resp = UrlFetchApp.fetch(WORKER_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    followRedirects: false
  });

  Logger.log('HTTP code: ' + resp.getResponseCode());
  Logger.log('Headers: ' + JSON.stringify(resp.getAllHeaders()));
  Logger.log('Body: ' + resp.getContentText());
}


function setupReporteSemanal() {
  // Elimina triggers anteriores del mismo tipo
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'reporteSemanal')
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Crea trigger: lunes a las 8AM
  ScriptApp.newTrigger('reporteSemanal')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();

  Logger.log('✅ Trigger semanal creado');
}

function setupTriggersDiarios() {
  // Elimina triggers anteriores
  ['resumenDiarioAutomatico', 'registrarGastosFijos', 'resumenMensualAutomatico', 'resumenAnualAutomatico'].forEach(fn => {
    ScriptApp.getProjectTriggers()
      .filter(t => t.getHandlerFunction() === fn)
      .forEach(t => ScriptApp.deleteTrigger(t));
  });

  // Resumen diario — 9PM Lima
  ScriptApp.newTrigger('resumenDiarioAutomatico')
    .timeBased()
    .everyDays(1)
    .atHour(21)
    .create();

  // Gastos fijos — 1ro de cada mes a las 8AM
  ScriptApp.newTrigger('registrarGastosFijos')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();

  // Resumen mensual del mes cerrado - dia 1 a las 9AM Lima
  ScriptApp.newTrigger('resumenMensualAutomatico')
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .create();

  // Resumen anual - corre mensual, pero solo envia en enero
  ScriptApp.newTrigger('resumenAnualAutomatico')
    .timeBased()
    .onMonthDay(1)
    .atHour(10)
    .create();

  Logger.log('✅ Triggers diarios y mensuales creados');
}


function guardarClaudeApiKey(apiKey) {
  if (!apiKey) throw new Error('apiKey requerido');

  PropertiesService.getScriptProperties()
    .setProperty('claude_api_key', String(apiKey));
  Logger.log('✅ API key guardada');
}

function guardarDashboardPropiedad(nombre, valor) {
  const permitidas = ['dashboard_api_key', 'dashboard_chat_id'];

  if (!permitidas.includes(nombre)) {
    throw new Error('Propiedad no permitida: ' + nombre);
  }

  PropertiesService.getScriptProperties()
    .setProperty(nombre, String(valor));

  Logger.log('✅ Propiedad dashboard guardada: ' + nombre);
}

function crearDashboardApiKey() {
  const key = 'mayeson_dash_' + Utilities.getUuid().replace(/-/g, '');

  PropertiesService.getScriptProperties()
    .setProperty('dashboard_api_key', key);

  Logger.log('✅ dashboard_api_key generada');
  return key;
}

function configurarDashboardChat(chatId) {
  if (!chatId) throw new Error('chatId requerido');

  PropertiesService.getScriptProperties()
    .setProperty('dashboard_chat_id', String(chatId));

  Logger.log('✅ dashboard_chat_id guardado: ' + chatId);
  return chatId;
}

function configurarD1Worker(apiUrl, adminKey) {
  if (!apiUrl || !adminKey) throw new Error('apiUrl y adminKey son requeridos');

  const props = PropertiesService.getScriptProperties();

  props.setProperty('d1_api_url', String(apiUrl));
  props.setProperty('d1_admin_key', String(adminKey));

  Logger.log('✅ D1 Worker configurado');
  return 'D1 Worker configurado';
}

function normalizarCategoriasHistoricas() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones');
  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('No hay transacciones para normalizar');
    return 'Sin transacciones';
  }

  const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7);
  const data = range.getValues();
  let cambios = 0;

  const normalizada = data.map(function (row) {
    const actual = String(row[4] || '').toLowerCase();
    const nueva = normalizarCat(actual, row[3], row[6]);

    if (nueva && nueva !== actual) {
      row[4] = nueva;
      cambios++;
    }

    return row;
  });

  if (cambios > 0) {
    range.setValues(normalizada);
  }

  Logger.log('Categorías normalizadas: ' + cambios);
  return 'Categorías normalizadas: ' + cambios;
}


function resetFinanzasParaDatosReales() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const stamp = Utilities.formatDate(new Date(), 'America/Lima', 'yyyyMMdd-HHmmss');
  const backup = DriveApp.getFileById(SHEET_ID).makeCopy(ss.getName() + ' backup antes reset ' + stamp);
  const specs = [
    {
      name: 'Transacciones',
      headers: ['Fecha', 'Hora', 'Tipo', 'Descripción', 'Categoría', 'Monto', 'ChatID'],
    },
    {
      name: 'Presupuestos',
      headers: ['ChatID', 'Categoría', 'Límite'],
    },
    {
      name: 'Metas',
      headers: ['ChatID', 'Nombre', 'Objetivo', 'Ahorrado', 'Creada'],
    },
    {
      name: 'Fijos',
      headers: ['ChatID', 'Nombre', 'Monto', 'Categoría'],
    },
    {
      name: 'CierresMensuales',
      headers: [
        'ChatID',
        'Periodo',
        'NombreMes',
        'Ingresos',
        'Gastos',
        'Balance',
        'Movimientos',
        'CategoriaPrincipal',
        'MontoCategoriaPrincipal',
        'CambioCategoriaPrincipal',
        'NivelAlerta',
        'SenalAnual',
        'SugerenciaIA',
        'Actualizado',
      ],
    },
  ];
  const result = {
    ok: true,
    backupName: backup.getName(),
    backupId: backup.getId(),
    sheets: {},
  };

  specs.forEach(function (spec) {
    let sheet = ss.getSheetByName(spec.name);
    if (!sheet) sheet = ss.insertSheet(spec.name);

    const previousRows = Math.max(sheet.getLastRow() - 1, 0);
    sheet.clearContents();
    sheet.getRange(1, 1, 1, spec.headers.length)
      .setValues([spec.headers])
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, spec.headers.length);

    result.sheets[spec.name] = {
      removedRows: previousRows,
      headers: spec.headers.length,
    };
  });

  SpreadsheetApp.flush();
  Logger.log('Reset financiero completado: ' + JSON.stringify(result));
  return result;
}

function setupTriggerFijosPendientes() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'alertarFijosPendientes')
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Corre el día 5 de cada mes a las 9AM
  ScriptApp.newTrigger('alertarFijosPendientes')
    .timeBased()
    .onMonthDay(5)
    .atHour(9)
    .create();

  Logger.log('✅ Trigger de fijos pendientes creado — día 5 de cada mes');
}
