// ---- GASTOS DESDE GMAIL ------------------------------------ \\
// Lee los avisos de BCP, BBVA, Interbank y correos de compras online,
// y te los envia a Telegram con botones. Nada se registra hasta que
// tocas "Registrar": ahi se guarda en Sheets + D1 igual que un gasto
// escrito a mano (registrarMovimiento).
//
// Activacion: ejecuta setupTriggerGmail() una vez desde el editor.
//
// Script Properties (opcionales):
//   gmail_chat_id           chat de Telegram destino (si no, usa dashboard_chat_id)
//   gmail_tarjetas_credito  ultimos 4 digitos de tus tarjetas de credito, separados por coma (default: 0192)
//   gmail_nombres_propios   nombres que marcan un movimiento como propio (default: mayeson)
//   gmail_desde             epoch en segundos desde el que se leen correos (lo fija setupTriggerGmail)
//   gmail_alias_fijos       textos del correo que corresponden a gastos fijos, ej:
//                           999888777=fijoa+fijob; nombre del colegio=fijoc

const GMAIL_HOJA_CONTROL = 'GmailMovimientos';
const GMAIL_CABECERAS = [
  'Clave', 'MensajeId', 'Estado', 'Procesado', 'Banco', 'Tipo', 'Fecha', 'Hora',
  'Descripcion', 'Categoria', 'Monto', 'Moneda', 'Metodo', 'Tarjeta', 'Aviso', 'TelegramMsgId', 'Fijos',
];
const GMAIL_COL = { estado: 3, cat: 10, metodo: 13, telegram: 16 };
const GMAIL_RE_MONTO = '(S\\/\\.?|US\\$|\\$|PEN|USD)\\s*([\\d,]+(?:\\.\\d{1,2})?)';

const GMAIL_FUENTES = [
  { banco: 'BCP', from: 'notificacionesbcp.com.pe', parser: parsearBCP_ },
  { banco: 'BBVA', from: 'bbva.com.pe', parser: parsearBBVA_ },
  { banco: 'Interbank', from: 'netinterbank.com.pe', parser: parsearInterbank_ },
  { banco: 'Yape', from: 'notificaciones@yape.pe', parser: parsearYape_ },
  { banco: 'Ligo', from: 'ligo.pe', parser: parsearLigo_ },
];
const GMAIL_FROM_BANCOS = '(from:notificacionesbcp.com.pe OR from:procesos@bbva.com.pe OR from:netinterbank.com.pe ' +
  'OR from:notificaciones@yape.pe OR from:no-reply@ligo.pe)';


// ---- ACTIVACION ---------------------------------------------

function setupTriggerGmail() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'revisarGastosGmail')
    .forEach(t => ScriptApp.deleteTrigger(t));

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('gmail_desde')) {
    props.setProperty('gmail_desde', String(Math.floor(Date.now() / 1000)));
  }

  GmailApp.getInboxUnreadCount(); // fuerza el permiso de Gmail
  hojaControlGmail_();

  ScriptApp.newTrigger('revisarGastosGmail')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('✅ Lector de Gmail activo. Lee correos desde: ' +
    new Date(Number(props.getProperty('gmail_desde')) * 1000));
}


// ---- PROCESO PRINCIPAL (trigger cada 10 min) ----------------

function revisarGastosGmail() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;

  try {
    procesarCorreosNuevosGmail_();
  } finally {
    lock.releaseLock();
  }
}

// Sin lock propio: tambien la usa el comando "revisar gmail", que ya corre dentro del lock de doPost.
function procesarCorreosNuevosGmail_() {
  const chatId = gmailChatId_();
  const desde = Number(PropertiesService.getScriptProperties().getProperty('gmail_desde') || 0);
  if (!chatId || !desde) {
    Logger.log('Gmail: falta gmail_chat_id/dashboard_chat_id o gmail_desde. Ejecuta setupTriggerGmail().');
    return;
  }

  const hoja = hojaControlGmail_();
  const procesados = idsProcesadosGmail_(hoja);

  [gmailQueryBancos_(desde), gmailQueryCompras_(desde)].forEach(query => {
    GmailApp.search(query, 0, 30).forEach(thread => {
      thread.getMessages().forEach(msg => {
        const msgId = msg.getId();
        if (procesados.has(msgId)) return;
        if (msg.getDate().getTime() / 1000 < desde) return;
        procesados.add(msgId);

        try {
          procesarCorreoGasto_(hoja, chatId, msg);
        } catch (err) {
          Logger.log('Error procesando correo ' + msgId + ': ' + err);
          registrarControlGmail_(hoja, {
            clave: gmailClave_(msgId), msgId: msgId, estado: 'error', aviso: String(err).slice(0, 200),
          });
        }
      });
    });
  });
}

function gmailQueryBancos_(desde) {
  return GMAIL_FROM_BANCOS + ' after:' + desde;
}

function gmailQueryCompras_(desde) {
  return '-from:notificacionesbcp.com.pe -from:bbva.com.pe -from:netinterbank.com.pe -from:interbank.pe ' +
    '-from:yape.pe -from:novedadesyape.pe -from:ligo.pe -from:pagoefectivo.pe ' +
    '-category:promotions ' +
    'subject:(compra OR pedido OR orden OR recibo OR boleta OR factura OR "comprobante de pago" OR "confirmacion de pago" OR "tu pago") ' +
    'after:' + desde;
}

function procesarCorreoGasto_(hoja, chatId, msg) {
  const from = String(msg.getFrom() || '');
  const asunto = quitarTildesGmail_(msg.getSubject() || '');
  const texto = textoCorreoGmail_(msg);
  const fuente = GMAIL_FUENTES.find(f => from.toLowerCase().indexOf(f.from) !== -1);

  const base = {
    clave: gmailClave_(msg.getId()),
    msgId: msg.getId(),
    banco: fuente ? fuente.banco : 'Compra online',
  };

  const datos = fuente
    ? fuente.parser(texto, asunto)
    : parsearCompraGenerica_(texto, from);

  if (!datos || !(datos.monto > 0)) {
    registrarControlGmail_(hoja, Object.assign(base, { estado: 'sin_gasto' }));
    return;
  }

  if (esMovimientoPropioGmail_(datos.contraparte || datos.desc)) {
    registrarControlGmail_(hoja, Object.assign(base, {
      estado: 'propio', tipo: datos.tipo, desc: datos.desc, monto: datos.monto, moneda: datos.moneda,
    }));
    return;
  }

  const descCorreo = capitalizar(limpiarDescGmail_(datos.desc) || base.banco);
  const metodo = datos.metodo || (esTarjetaCreditoGmail_(datos.tarjeta) ? 'credito' : 'debito');
  const fijos = buscarFijosGmail_(chatId, descCorreo + ' ' + (datos.servicio || ''), texto);
  // Un solo fijo: se usa su nombre, asi D1 lo marca pagado. Varios (ej. recibo Entel): queda la descripcion del correo.
  const desc = fijos.length === 1 ? capitalizar(fijos[0].nombre) : descCorreo;
  const catBase = datos.tipo === 'servicio' ? 'servicios' : 'otro';

  const item = Object.assign(base, {
    estado: 'pendiente',
    tipo: datos.tipo,
    fecha: Utilities.formatDate(msg.getDate(), 'America/Lima', 'yyyy-MM-dd'),
    hora: Utilities.formatDate(msg.getDate(), 'America/Lima', 'HH:mm'),
    desc: desc,
    cat: fijos.length ? normalizarCat(fijos[0].cat || catBase, desc, chatId) : normalizarCat(catBase, desc, chatId),
    monto: datos.monto,
    moneda: datos.moneda,
    metodo: metodo,
    tarjeta: datos.tarjeta ? base.banco + ' *' + datos.tarjeta : '',
    fijos: fijos.map(f => f.nombre).join('+'),
  });
  const avisos = [];
  // Sin fijo ni regla: la IA sugiere la categoria (se confirma al registrar).
  if (!fijos.length && item.cat === 'otro') {
    const sugerida = clasificarConIAGmail_(desc, datos.tipo);
    if (sugerida) {
      item.cat = sugerida;
      avisos.push('🤖 Categoría sugerida por IA. Si no es, cámbiala con 🏷️');
    }
  }
  if (fijos.length) {
    avisos.push('📌 ' + (fijos.length === 1 ? 'Es tu gasto fijo ' : 'Cubre tus fijos: ') +
      fijos.map(f => capitalizar(f.nombre)).join(', ') + '. Al registrarlo queda pagado.');
  }
  if (datos.cip && esRecargaLigoGmail_(datos.cip)) {
    item.desc = 'Recarga a Ligo';
    avisos.push('🔁 Parece una recarga a tu Ligo (código CIP coincide)');
  }
  const duplicado = posibleDuplicadoGmail_(hoja, item);
  if (duplicado) avisos.push(duplicado);
  item.aviso = avisos.join('\n');

  const fila = registrarControlGmail_(hoja, item);
  const telegramId = enviarAvisoGmail_(chatId, item);
  if (telegramId) hoja.getRange(fila, GMAIL_COL.telegram).setValue(telegramId);
}


// ---- PARSERS POR BANCO --------------------------------------
// Reciben el texto del correo sin HTML, sin tildes y en una sola linea.

function parsearBCP_(t, asunto) {
  if (/entre mis cuentas/i.test(asunto)) return null;
  const R = GMAIL_RE_MONTO;
  const op = numeroOperacionGmail_(t);
  let m;

  m = t.match(new RegExp('Realizaste un consumo de ' + R + ' con tu Tarjeta de (Debito|Credito)[^.]*? en (.+?)\\. Por tu seguridad', 'i'));
  if (m) {
    const credito = /credito/i.test(m[3]);
    const tarjeta = (t.match(/Numero de Tarjeta de (?:Debito|Credito)\s*:?\s*[*\s]*(\d{4})/i) || [])[1] || '';
    return {
      tipo: 'consumo', moneda: monedaGmail_(m[1]), monto: montoGmail_(m[2]),
      desc: m[4], metodo: credito ? 'credito' : 'debito', tarjeta: credito ? tarjeta : '', op: op,
    };
  }

  m = t.match(new RegExp('Realizaste una transferencia de ' + R, 'i'));
  if (m) {
    const dest = destinoBCP_(t);
    return {
      tipo: 'transferencia', moneda: monedaGmail_(m[1]), monto: montoGmail_(m[2]),
      desc: dest ? 'Transferencia a ' + dest : 'Transferencia BCP', contraparte: dest, metodo: 'debito', op: op,
    };
  }

  m = t.match(new RegExp('Realizaste un yapeo a celular de ' + R, 'i'));
  if (m) {
    const dest = destinoBCP_(t);
    return {
      tipo: 'yape', moneda: monedaGmail_(m[1]), monto: montoGmail_(m[2]),
      desc: dest ? 'Yape a ' + dest : 'Yape', contraparte: dest, metodo: 'debito', op: op,
    };
  }

  m = t.match(new RegExp('Realizaste un retiro de ' + R, 'i'));
  if (m) {
    return {
      tipo: 'retiro', moneda: monedaGmail_(m[1]), monto: montoGmail_(m[2]),
      desc: 'Retiro de efectivo', metodo: 'debito', op: op,
    };
  }

  // Pago de servicios (Entel, WIN, Luz del Sur, Sedapal...) desde Banca Movil
  if (/Operacion realizada\s*:?\s*Pago de servicios/i.test(t)) {
    m = t.match(new RegExp('Monto total\\s*:?\\s*' + R, 'i')) ||
      t.match(new RegExp('Importe\\s*:?\\s*' + R, 'i'));
    if (!m) return null;
    const empresa = ((t.match(/Empresa\s*:?\s*(.+?)\s+Servicio\s*:/i) || [])[1] || '').trim();
    const servicio = ((t.match(/\bServicio\s*:\s*(.+?)\s+Titular/i) || [])[1] || '').trim();
    const tc = t.match(/Cuenta de origen\s*:?\s*Tarjeta de Credito\D*(\d{4})/i);
    return {
      tipo: 'servicio', moneda: monedaGmail_(m[1]), monto: montoGmail_(m[2]),
      desc: empresa ? 'Pago ' + empresa : 'Pago de servicio', servicio: servicio,
      metodo: tc ? 'credito' : 'debito', tarjeta: tc ? tc[1] : '', op: op,
    };
  }

  return null;
}

function destinoBCP_(t) {
  return ((t.match(/Enviado a\s+(.+?)\s+\*{2,}/i) || [])[1] || '').trim();
}

function parsearBBVA_(t) {
  const R = GMAIL_RE_MONTO;
  const op = numeroOperacionGmail_(t);
  let m;

  m = t.match(/Comercio:\s*(.+?)\s+Monto:\s*([\d,]+(?:\.\d{1,2})?)\s+Moneda:\s*(PEN|USD)/i);
  if (m) {
    return {
      tipo: 'consumo', moneda: m[3].toUpperCase(), monto: montoGmail_(m[2]), desc: m[1],
      tarjeta: (t.match(/terminada en\s*\*?\s*(\d{4})/i) || [])[1] || '', op: op,
    };
  }

  m = t.match(new RegExp('Importe cargado\\s*:?\\s*' + R, 'i'));
  if (m) {
    const servicio = (t.match(/Nombre de servicio\s+(.+?)\s+(?:Descripcion|Recuerda|Numero|Codigo)/i) || [])[1];
    const tarjeta = (t.match(/Cargo en tarjeta\s*\W*\s*(\d{4})/i) || [])[1] || '';
    const cip = (t.match(/CODIGO CIP\s*0*(\d{5,})/i) || [])[1] || '';
    return {
      cip: cip,
      tipo: 'servicio', moneda: monedaGmail_(m[1]), monto: montoGmail_(m[2]),
      desc: servicio ? 'Pago ' + servicio : 'Pago de servicio',
      tarjeta: tarjeta, metodo: tarjeta ? '' : 'debito', op: op,
    };
  }

  m = t.match(new RegExp('Plineaste ' + R + ' a (.+?)\\s+Detalles', 'i'));
  if (m) {
    return {
      tipo: 'plin', moneda: monedaGmail_(m[1]), monto: montoGmail_(m[2]),
      desc: 'Plin a ' + m[3], contraparte: m[3], metodo: 'debito', op: op,
    };
  }

  return null;
}

function parsearInterbank_(t, asunto) {
  if (!/constancia de (transferencia|pago plin)/i.test(asunto)) return null;
  const R = GMAIL_RE_MONTO;
  const m = t.match(new RegExp('Monto total\\s*:?\\s*' + R, 'i')) ||
    t.match(new RegExp('Monto y moneda\\s*:?\\s*' + R, 'i'));
  if (!m) return null;

  const dest = ((t.match(/(?:Cuenta destino|Destinatario)\s+(.+?)\s+(?:\d{6,}|Tipo de operacion|Destino|Monto)/i) || [])[1] || '').trim();
  const esPlin = /plin/i.test(asunto);
  return {
    tipo: esPlin ? 'plin' : 'transferencia', moneda: monedaGmail_(m[1]), monto: montoGmail_(m[2]),
    desc: (esPlin ? 'Plin a ' : 'Transferencia a ') + (dest || 'tercero'),
    contraparte: dest, metodo: 'debito',
    op: (t.match(/Codigo de operacion\s*:?\s*(\d+)/i) || [])[1] || '',
  };
}

// Yape: solo el aviso "Acabas de yapear exitosamente" (no los de configuracion).
function parsearYape_(t) {
  const m = t.match(new RegExp('Acabas de yapear exitosamente!?\\s*Monto de yapeo\\*?\\s*' + GMAIL_RE_MONTO, 'i'));
  if (!m) return null;
  const dest = ((t.match(/Nombre del Beneficiario\s+(.+?)\s+N\W{0,3}\s*de operacion/i) || [])[1] || '')
    .replace(/\*+$/, '').trim();
  return {
    tipo: 'yape', moneda: monedaGmail_(m[1]), monto: montoGmail_(m[2]),
    desc: dest ? 'Yape a ' + dest : 'Yape', contraparte: dest, metodo: 'debito',
    op: (t.match(/N\W{0,3}\s*de operacion\s*:?\s*(\d+)/i) || [])[1] || '',
  };
}

// Ligo: pagos Plin/transferencias que hiciste. "Usuario" es el destinatario.
function parsearLigo_(t) {
  if (!/pago que hiciste|transferencia/i.test(t)) return null;
  const m = t.match(new RegExp('Monto total:?\\s*' + GMAIL_RE_MONTO, 'i'));
  if (!m) return null;
  const dest = ((t.match(/Usuario:?\s+(.+?)\s+(?:Destino|Monto)/i) || [])[1] || '').trim();
  const destino = ((t.match(/Destino:?\s+(.+?)\s+Monto/i) || [])[1] || '').trim();
  return {
    tipo: 'plin', moneda: monedaGmail_(m[1]), monto: montoGmail_(m[2]),
    desc: 'Plin a ' + (dest || 'tercero') + (destino ? ' (' + destino + ')' : ''),
    contraparte: dest, metodo: 'debito',
  };
}

// Recarga a Ligo: PagoEfectivo envia un correo con el mismo CIP que dice "LIGO".
function esRecargaLigoGmail_(cip) {
  try {
    const threads = GmailApp.search('from:pagoefectivo.pe ' + cip + ' newer_than:7d', 0, 5);
    return threads.some(th => th.getMessages().some(msg => {
      const texto = textoCorreoGmail_(msg);
      return texto.indexOf(cip) !== -1 && /\bLIGO\b/i.test(texto + ' ' + msg.getSubject());
    }));
  } catch (err) {
    Logger.log('esRecargaLigoGmail_: ' + err);
    return false;
  }
}

// Tiendas, apps y suscripciones: toma el ultimo "total" del correo.
// No adivina el metodo de pago; queda en debito y lo cambias con el boton.
function parsearCompraGenerica_(t, from) {
  const re = new RegExp(
    '(?:importe total|monto total|total pagado|monto pagado|total a pagar|total cobrado|\\btotal)\\s*:?\\s*' + GMAIL_RE_MONTO,
    'gi'
  );
  let m;
  let ultimo = null;
  while ((m = re.exec(t)) !== null) ultimo = m;
  if (!ultimo) return null;

  const remitente = String(from).replace(/<[^>]*>/g, '').replace(/"/g, '').trim();
  return {
    tipo: 'compra', moneda: monedaGmail_(ultimo[1]), monto: montoGmail_(ultimo[2]),
    desc: remitente || 'Compra online',
  };
}


// ---- TELEGRAM: AVISO Y BOTONES ------------------------------

function enviarAvisoGmail_(chatId, item) {
  const res = telegramApiGmail_('sendMessage', {
    chat_id: chatId,
    text: textoAvisoGmail_(item, ''),
    parse_mode: 'HTML',
    reply_markup: tecladoAvisoGmail_(item),
  });
  return res && res.ok ? res.result.message_id : null;
}

function textoAvisoGmail_(item, cierre) {
  const pago = item.metodo === 'credito'
    ? '💳 Crédito' + (item.tarjeta ? ' · ' + item.tarjeta : '')
    : '💳 Débito';
  const lineas = [
    '📩 <b>Gasto detectado · ' + escaparHtmlGmail_(item.banco) + '</b>',
    '',
    '🔴 ' + escaparHtmlGmail_(item.desc),
    '💵 ' + escaparHtmlGmail_(formatoMoneda_(item.monto, item.moneda)),
    '🏷️ ' + escaparHtmlGmail_(capitalizar(item.cat)),
    pago,
    '📅 ' + item.fecha + ' ' + item.hora,
  ];
  if (item.aviso) lineas.push('', escaparHtmlGmail_(item.aviso));
  lineas.push('', cierre || '¿Lo registro?');
  return lineas.join('\n');
}

function tecladoAvisoGmail_(item) {
  const k = item.clave;
  return {
    inline_keyboard: [
      [
        { text: '✅ Registrar', callback_data: 'gm|ok|' + k },
        { text: '❌ Ignorar', callback_data: 'gm|no|' + k },
      ],
      [
        { text: '🏷️ Categoría', callback_data: 'gm|cats|' + k },
        { text: item.metodo === 'credito' ? '💳 Pasar a débito' : '💳 Pasar a crédito', callback_data: 'gm|pay|' + k },
      ],
    ],
  };
}

function tecladoCategoriasGmail_(item) {
  const filas = [];
  for (let i = 0; i < CATS_GASTO.length; i += 3) {
    filas.push(CATS_GASTO.slice(i, i + 3).map((cat, j) => ({
      text: (cat === item.cat ? '• ' : '') + capitalizar(cat),
      callback_data: 'gm|cat|' + item.clave + '|' + (i + j),
    })));
  }
  filas.push([{ text: '↩️ Volver', callback_data: 'gm|back|' + item.clave }]);
  return { inline_keyboard: filas };
}

// Lo llama doPost cuando llega un callback_query (toque de boton).
function manejarCallbackGmail_(cb) {
  const data = String(cb.data || '');
  if (data.indexOf('gm|') !== 0) {
    responderCallbackGmail_(cb.id, '');
    return;
  }

  const chatId = String((cb.message && cb.message.chat && cb.message.chat.id) || '');
  const messageId = cb.message && cb.message.message_id;
  if (chatId !== String(gmailChatId_())) {
    responderCallbackGmail_(cb.id, 'No autorizado');
    return;
  }

  const partes = data.split('|');
  const accion = partes[1];
  const item = leerItemGmail_(partes[2]);

  if (!item) {
    responderCallbackGmail_(cb.id, 'No encontré este gasto');
    return;
  }
  if (item.estado !== 'pendiente') {
    responderCallbackGmail_(cb.id, 'Este gasto ya fue ' + item.estado);
    return;
  }

  if (accion === 'ok') {
    actualizarItemGmail_(item, GMAIL_COL.estado, 'registrado');
    const res = registrarGastoGmail_(chatId, item);
    const pagados = marcarFijosPagadosGmail_(chatId, item);
    const aprendida = aprenderReglaGmail_(chatId, item);
    const cierre = '✅ <b>Registrado</b>' +
      (pagados.length ? '\n📌 Fijos pagados: ' + pagados.join(', ') : '') +
      (aprendida ? '\n🧠 La próxima vez "' + aprendida + '" irá directo a ' + capitalizar(item.cat) : '') +
      (res.d1Ok ? '' : '\n⚠️ Guardado en Sheets, pero D1 no respondió.');
    editarAvisoGmail_(chatId, messageId, item, cierre);
    responderCallbackGmail_(cb.id, 'Registrado');
    if (res.pago.metodo !== 'credito') verificarPresupuesto(chatId, item.cat);
    return;
  }

  if (accion === 'no') {
    actualizarItemGmail_(item, GMAIL_COL.estado, 'ignorado');
    editarAvisoGmail_(chatId, messageId, item, '❌ <b>Ignorado</b>');
    responderCallbackGmail_(cb.id, 'Ignorado');
    return;
  }

  if (accion === 'pay') {
    item.metodo = item.metodo === 'credito' ? 'debito' : 'credito';
    actualizarItemGmail_(item, GMAIL_COL.metodo, item.metodo);
    editarAvisoGmail_(chatId, messageId, item, '');
    responderCallbackGmail_(cb.id, item.metodo === 'credito' ? 'Crédito' : 'Débito');
    return;
  }

  if (accion === 'cats') {
    telegramApiGmail_('editMessageReplyMarkup', {
      chat_id: chatId, message_id: messageId, reply_markup: tecladoCategoriasGmail_(item),
    });
    responderCallbackGmail_(cb.id, '');
    return;
  }

  if (accion === 'cat') {
    const cat = CATS_GASTO[Number(partes[3])];
    if (cat) {
      item.cat = cat;
      actualizarItemGmail_(item, GMAIL_COL.cat, cat);
    }
    editarAvisoGmail_(chatId, messageId, item, '');
    responderCallbackGmail_(cb.id, cat ? capitalizar(cat) : '');
    return;
  }

  if (accion === 'back') {
    editarAvisoGmail_(chatId, messageId, item, '');
    responderCallbackGmail_(cb.id, '');
    return;
  }

  responderCallbackGmail_(cb.id, '');
}

// cierre vacio = sigue pendiente (con botones); con texto = estado final (sin botones).
function editarAvisoGmail_(chatId, messageId, item, cierre) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: textoAvisoGmail_(item, cierre),
    parse_mode: 'HTML',
  };
  if (!cierre) payload.reply_markup = tecladoAvisoGmail_(item);
  telegramApiGmail_('editMessageText', payload);
}

function responderCallbackGmail_(callbackId, texto) {
  telegramApiGmail_('answerCallbackQuery', { callback_query_id: callbackId, text: texto || '' });
}

function telegramApiGmail_(metodo, payload) {
  const resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + TOKEN + '/' + metodo, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  try {
    const json = JSON.parse(resp.getContentText());
    if (!json.ok) Logger.log('Telegram ' + metodo + ': ' + resp.getContentText());
    return json;
  } catch (err) {
    Logger.log('Telegram ' + metodo + ' sin JSON: ' + err);
    return null;
  }
}


// ---- REGISTRO (mismo formato que registrarMovimiento) -------

function registrarGastoGmail_(chatId, item) {
  // La tarjeta de credito usa la configurada en el bot (credit_card_name), igual que los gastos manuales.
  const pago = construirPago_(item.metodo, item.fecha, '', '');

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones')
    || crearHojaTransacciones();
  asegurarColumnasPagoTransacciones_(sheet);
  sheet.appendRow([
    item.fecha, item.hora, 'gasto', item.desc, item.cat, item.monto, chatId,
    pago.metodo, pago.fechaPago, pago.tarjeta, item.moneda,
  ]);

  const d1Ok = guardarTransaccionD1({
    chatId: chatId,
    fecha: item.fecha,
    hora: item.hora,
    tipo: 'gasto',
    desc: item.desc,
    cat: item.cat,
    monto: item.monto,
    currency: item.moneda,
    paymentMethod: pago.metodo,
    paymentDueDate: pago.fechaPago,
    cardName: pago.tarjeta,
    source: 'gmail',
  });

  return { pago: pago, d1Ok: !!d1Ok };
}


// ---- HOJA DE CONTROL ----------------------------------------
// Guarda cada correo procesado: evita avisos repetidos y conserva
// los datos del gasto mientras esperas para confirmarlo.

function hojaControlGmail_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let hoja = ss.getSheetByName(GMAIL_HOJA_CONTROL);
  if (!hoja) {
    hoja = ss.insertSheet(GMAIL_HOJA_CONTROL);
    hoja.appendRow(GMAIL_CABECERAS);
    hoja.getRange(1, 1, 1, GMAIL_CABECERAS.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
  } else if (!hoja.getRange(1, GMAIL_CABECERAS.length).getValue()) {
    hoja.getRange(1, GMAIL_CABECERAS.length).setValue(GMAIL_CABECERAS[GMAIL_CABECERAS.length - 1]).setFontWeight('bold');
  }
  return hoja;
}

function idsProcesadosGmail_(hoja) {
  const n = hoja.getLastRow();
  if (n < 2) return new Set();
  return new Set(hoja.getRange(2, 2, n - 1, 1).getDisplayValues().map(r => String(r[0])));
}

function registrarControlGmail_(hoja, it) {
  // El apostrofe obliga a Sheets a guardar texto (evita que convierta ids o fechas).
  hoja.appendRow([
    "'" + it.clave, "'" + it.msgId, it.estado, new Date(), it.banco || '', it.tipo || '',
    it.fecha ? "'" + it.fecha : '', it.hora ? "'" + it.hora : '',
    it.desc || '', it.cat || '', it.monto || '', it.moneda || '', it.metodo || '', it.tarjeta || '',
    it.aviso || '', '', it.fijos || '',
  ]);
  return hoja.getLastRow();
}

function leerItemGmail_(clave) {
  if (!clave) return null;
  const hoja = hojaControlGmail_();
  const celda = hoja.getRange('A:A').createTextFinder(clave).matchEntireCell(true).findNext();
  if (!celda) return null;

  const fila = celda.getRow();
  const rango = hoja.getRange(fila, 1, 1, GMAIL_CABECERAS.length);
  const v = rango.getValues()[0];
  const d = rango.getDisplayValues()[0];
  return {
    fila: fila, clave: d[0], msgId: d[1], estado: d[2], banco: d[4], tipo: d[5],
    fecha: d[6], hora: d[7], desc: d[8], cat: d[9], monto: Number(v[10]), moneda: d[11],
    metodo: d[12], tarjeta: d[13], aviso: d[14], fijos: d[16] || '',
  };
}

function actualizarItemGmail_(item, col, valor) {
  hojaControlGmail_().getRange(item.fila, col).setValue(valor);
}

// Avisa si otro origen (banco o tienda) ya trajo el mismo monto en +-2 dias.
function posibleDuplicadoGmail_(hoja, item) {
  const n = hoja.getLastRow();
  if (n < 2) return '';
  const inicio = Math.max(2, n - 199);
  const rango = hoja.getRange(inicio, 1, n - inicio + 1, GMAIL_CABECERAS.length);
  const vals = rango.getValues();
  const disp = rango.getDisplayValues();
  const fechaItem = new Date(item.fecha + 'T12:00:00');

  for (let i = vals.length - 1; i >= 0; i--) {
    const estado = disp[i][2];
    if (estado !== 'pendiente' && estado !== 'registrado') continue;
    if (disp[i][4] === item.banco) continue;
    if (disp[i][11] !== item.moneda) continue;
    if (Math.abs(Number(vals[i][10]) - item.monto) > 0.009) continue;
    const fecha = new Date(disp[i][6] + 'T12:00:00');
    if (isNaN(fecha) || Math.abs(fecha - fechaItem) > 2 * 86400000) continue;
    return '⚠️ Posible duplicado de ' + disp[i][4] + ': ' + disp[i][8] + ' (' + disp[i][6] + ')';
  }
  return '';
}


// ---- CATEGORIZACION AUTOMATICA ------------------------------
// Capa 2: la IA sugiere categoria cuando ninguna regla calza.
// Solo se envia el nombre del comercio y el tipo de movimiento.
function clasificarConIAGmail_(desc, tipo) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('claude_api_key');
  const clave = claveComercioGmail_(desc);
  if (!apiKey || !clave) return '';

  const cache = CacheService.getScriptCache();
  const cacheKey = 'ia_cat_' + Utilities.base64EncodeWebSafe(clave).slice(0, 200);
  const cached = cache.get(cacheKey);
  if (cached) return cached === '-' ? '' : cached;

  const prompt = [
    'Clasifica este movimiento bancario de una persona en Peru en UNA de estas categorias:',
    CATS_GASTO.join(', ') + '.',
    'Criterios: comida rapida (KFC, Bembos, pizzas, hamburguesas), cine, streaming, juegos = entretenimiento;',
    'supermercados, mercados, abarrotes, restaurantes de menu, cafes, panaderias = supermercado;',
    'luz, agua, gas de casa, telefono, internet, alquiler = servicios; gasolina, taxi, apps de transporte, peajes, estacionamiento, SOAT = transporte;',
    'farmacias, clinicas, gimnasio = salud; tiendas de ropa y calzado = ropa; colegios, cursos, libros = educacion.',
    'Si no puedes saberlo con razonable seguridad (por ejemplo, transferencia a una persona), responde otro.',
    '',
    'Movimiento: ' + (tipo || 'consumo') + ' en "' + String(desc).slice(0, 120) + '"',
    'Responde solo la categoria, en minusculas, sin explicacion.',
  ].join('\n');

  try {
    const url = props.getProperty('claude_api_url') || 'https://api.synterolink.com/v1/messages';
    const model = props.getProperty('claude_model') || 'claude-haiku-4-5-20251001';
    let resp = fetchIAConReintentos_(url, {
      method: 'post',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      payload: JSON.stringify({ model: model, max_tokens: 10, messages: [{ role: 'user', content: prompt }] }),
      muteHttpExceptions: true,
    }, 'categoria gmail');
    let raw = resp.getContentText();
    let texto = '';
    if (debeReintentarChatCompletions_(resp.getResponseCode(), raw, url)) {
      resp = llamarIAChatCompletions_(apiKey, url, model, 10, prompt, '', '');
      raw = resp.getContentText();
      const r = parseJsonSeguro_(raw, null);
      texto = r && r.choices && r.choices[0] && r.choices[0].message ? r.choices[0].message.content : '';
    } else {
      const r = parseJsonSeguro_(raw, null);
      const bloque = r && r.content ? r.content.find(b => b.type === 'text') : null;
      texto = bloque ? bloque.text : '';
    }

    const cat = normalizarCatBasica_(normalizarTextoClave_(texto).split(' ')[0]);
    const valida = CATS_GASTO.indexOf(cat) !== -1 && cat !== 'otro' ? cat : '';
    cache.put(cacheKey, valida || '-', 21600);
    return valida;
  } catch (err) {
    Logger.log('clasificarConIAGmail_: ' + err);
    return '';
  }
}

// Capa 3: al registrar, guarda una regla personal comercio -> categoria
// si las reglas actuales no la daban. Devuelve la palabra aprendida.
function aprenderReglaGmail_(chatId, item) {
  try {
    if (item.fijos || !item.cat || item.cat === 'otro') return '';
    const clave = claveComercioGmail_(item.desc);
    if (!clave) return '';
    const porReglas = clasificarCategoriaD1_('otro', item.desc, chatId);
    if (porReglas && normalizarCatBasica_(porReglas) === item.cat) return '';
    guardarReglaCategoriaD1_(chatId, clave, item.cat);
    return clave;
  } catch (err) {
    Logger.log('aprenderReglaGmail_: ' + err);
    return '';
  }
}

// Palabra que identifica al comercio o destinatario:
//   "Kfc155 - puruchuco"          -> "kfc"
//   "Google YouTubePremium"       -> "google youtubepremium"  (pasarelas: 2 palabras)
//   "Transferencia a Juan Perez"  -> "juan perez"
function claveComercioGmail_(desc) {
  const genericas = ['pago', 'compra', 'consumo', 'de', 'del', 'la', 'el', 'los', 'en', 'sac', 'sa', 'srl', 'eirl',
    'peru', 'lima', 'www', 'com', 'pe', 'tienda', 'online'];
  const pasarelas = ['google', 'apple', 'paypal', 'izi', 'izipay', 'niubiz', 'mercadopago', 'dlocal', 'payu',
    'culqi', 'openpay', 'pagoefectivo', 'amazon', 'microsoft'];
  let texto = normalizarTextoClave_(desc);
  const persona = texto.match(/^(?:transferencia|yape|plin) a (.+)$/);
  if (persona) texto = persona[1];
  const palabras = texto.replace(/\d+/g, ' ').split(/\s+/)
    .filter(w => w.length >= 2 && genericas.indexOf(w) === -1);
  if (!palabras.length) return '';
  if (persona && palabras.length < 2) return ''; // un solo nombre es ambiguo: "maria" calzaria con "mariano"
  const n = persona || pasarelas.indexOf(palabras[0]) !== -1 ? 2 : 1;
  const clave = palabras.slice(0, n).join(' ');
  return clave.replace(/\s+/g, '').length >= 3 ? clave : '';
}


// ---- GASTOS FIJOS --------------------------------------------
// Relaciona el correo con tus gastos fijos pendientes del mes:
//  1) alias de gmail_alias_fijos encontrados en el correo completo (ej. numero de linea Entel)
//  2) nombre del fijo dentro de la descripcion (sin espacios: "YouTubePremium" calza con "youtube")
function buscarFijosGmail_(chatId, descripcion, textoCompleto) {
  let fijos;
  try {
    fijos = leerFijos_(chatId).filter(f => !f.pagadoMes && !f.saltadoMes);
  } catch (err) {
    Logger.log('buscarFijosGmail_: ' + err);
    return [];
  }
  if (!fijos.length) return [];

  const compactar = s => normalizarTextoClave_(s).replace(/\s+/g, '');
  const porNombre = nombre => fijos.find(f => compactar(f.nombre) === compactar(nombre));

  const correo = compactar(textoCompleto);
  const alias = PropertiesService.getScriptProperties().getProperty('gmail_alias_fijos') || '';
  for (const regla of alias.split(';')) {
    const partes = regla.split('=');
    const clave = compactar(partes[0] || '');
    if (partes.length !== 2 || clave.length < 3 || correo.indexOf(clave) === -1) continue;
    const encontrados = partes[1].split('+').map(porNombre).filter(Boolean);
    if (encontrados.length) return encontrados;
  }

  const desc = compactar(descripcion);
  const fijo = fijos.find(f => {
    const nombre = compactar(f.nombre);
    return nombre.length >= 3 && desc.indexOf(nombre) !== -1;
  });
  return fijo ? [fijo] : [];
}

function marcarFijosPagadosGmail_(chatId, item) {
  if (!item.fijos) return [];
  const mes = cicloPagoDesdeFecha_(new Date(item.fecha + 'T12:00:00')).key;
  const pagados = [];
  item.fijos.split('+').forEach(nombre => {
    const fijo = buscarFijo_(chatId, nombre);
    if (fijo && marcarEstadoFijoD1_(chatId, fijo, 'pagado', mes)) pagados.push(capitalizar(fijo.nombre));
  });
  return pagados;
}


// ---- UTILIDADES ---------------------------------------------

function gmailChatId_() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('gmail_chat_id') || props.getProperty('dashboard_chat_id') || '';
}

function gmailClave_(msgId) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(msgId));
  return 'g' + bytes.map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('').slice(0, 10);
}

function textoCorreoGmail_(msg) {
  let texto = String(msg.getBody() || '')
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|tr|td|th|li|h\d|table|span)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  texto = decodificarEntidadesGmail_(texto);
  if (!texto.trim()) texto = msg.getPlainBody() || '';
  return quitarTildesGmail_(texto).replace(/\s+/g, ' ').trim();
}

function decodificarEntidadesGmail_(s) {
  const mapa = {
    nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", bull: '•',
    aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
    Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ',
    iexcl: '¡', iquest: '¿', ordm: 'º', deg: '°',
  };
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (mapa[n] !== undefined ? mapa[n] : m));
}

function quitarTildesGmail_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function limpiarDescGmail_(s) {
  return String(s || '')
    .replace(/\*\d{4,}/g, ' ')            // IZI*BILCON GAS*00589176 -> quita el codigo final
    .replace(/^(IZI|IZIPAY|NIUBIZ|DLC|MP|PAYU)\s*\*/i, '')
    .replace(/\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function numeroOperacionGmail_(t) {
  return (t.match(/Numero de operacion\s*:?\s*([A-Z0-9]{4,})/i) || [])[1] || '';
}

function montoGmail_(valor) {
  return Number(String(valor).replace(/,/g, ''));
}

function monedaGmail_(simbolo) {
  const s = String(simbolo || '').toUpperCase();
  return s.indexOf('S/') === 0 || s === 'PEN' ? 'PEN' : 'USD';
}

function esTarjetaCreditoGmail_(ultimos4) {
  if (!ultimos4) return false;
  const lista = PropertiesService.getScriptProperties().getProperty('gmail_tarjetas_credito') || '0192';
  return lista.split(',').map(x => x.trim()).indexOf(String(ultimos4)) !== -1;
}

function esMovimientoPropioGmail_(texto) {
  const clave = quitarTildesGmail_(texto).toLowerCase();
  if (!clave) return false;
  const nombres = (PropertiesService.getScriptProperties().getProperty('gmail_nombres_propios') || 'mayeson')
    .split(',')
    .map(n => quitarTildesGmail_(n).toLowerCase().trim())
    .filter(Boolean);
  return nombres.some(n => clave.indexOf(n) !== -1);
}

function escaparHtmlGmail_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


// ---- PRUEBA REAL CON TELEGRAM -------------------------------
// Toma tu ultimo consumo del BCP o BBVA (aunque sea anterior a gmail_desde)
// y te envia el aviso con botones, para probar el flujo completo.
// Si ese gasto ya lo registraste a mano, toca "Ignorar".
function probarAvisoGmail() {
  const chatId = gmailChatId_();
  if (!chatId) throw new Error('Falta gmail_chat_id o dashboard_chat_id en Script Properties');

  const hoja = hojaControlGmail_();
  const procesados = idsProcesadosGmail_(hoja);
  const query = '(from:notificacionesbcp.com.pe OR from:procesos@bbva.com.pe) subject:consumo newer_than:30d';

  const threads = GmailApp.search(query, 0, 10);
  for (let i = 0; i < threads.length; i++) {
    const mensajes = threads[i].getMessages().reverse();
    for (let j = 0; j < mensajes.length; j++) {
      const msg = mensajes[j];
      if (procesados.has(msg.getId())) continue;
      procesarCorreoGasto_(hoja, chatId, msg);
      Logger.log('Aviso de prueba enviado: ' + msg.getSubject() + ' (' + msg.getDate() + ')');
      return true;
    }
  }
  Logger.log('No encontré consumos sin procesar en los últimos 30 días.');
  return false;
}


// ---- PRUEBA MANUAL ------------------------------------------
// Ejecutala desde el editor: muestra en el log que entenderia el lector
// de los ultimos correos, sin enviar nada a Telegram ni registrar.
function probarLectorGmail() {
  const query = GMAIL_FROM_BANCOS + ' newer_than:15d';
  GmailApp.search(query, 0, 15).forEach(thread => {
    thread.getMessages().forEach(msg => {
      const from = String(msg.getFrom() || '').toLowerCase();
      const fuente = GMAIL_FUENTES.find(f => from.indexOf(f.from) !== -1);
      if (!fuente) return;
      const datos = fuente.parser(textoCorreoGmail_(msg), quitarTildesGmail_(msg.getSubject() || ''));
      const propio = datos && esMovimientoPropioGmail_(datos.contraparte || datos.desc);
      Logger.log(fuente.banco + ' | ' + msg.getSubject() + ' -> ' +
        (datos ? JSON.stringify(datos) + (propio ? ' [PROPIO, se descarta]' : '') : 'sin gasto'));
    });
  });
}


// ---- ALIAS DE FIJOS DESDE TELEGRAM --------------------------
//   alias fijos                                -> lista los alias
//   alias fijo 999888777=fijoa+fijob           -> crea o reemplaza el alias de ese texto
//   alias fijo borrar 999888777                -> quita ese alias
// Se guardan en la Script Property gmail_alias_fijos.
function cmdAliasFijos_(chatId, lower) {
  if (String(chatId) !== String(gmailChatId_())) {
    return sendMessage(chatId, '⛔ Este comando solo funciona en tu chat principal.');
  }
  const props = PropertiesService.getScriptProperties();
  const reglas = (props.getProperty('gmail_alias_fijos') || '')
    .split(';').map(r => r.trim()).filter(r => r.indexOf('=') > 0);
  const claveDe = r => normalizarTextoClave_(r.split('=')[0]).replace(/\s+/g, '');
  const guardar = lista => props.setProperty('gmail_alias_fijos', lista.join('; '));
  const arg = lower.replace(/^alias fijos?\s*/, '').trim();

  if (!arg) {
    return sendMessage(chatId, reglas.length
      ? '📌 Alias de fijos:\n' + reglas.map(r => '• ' + r).join('\n')
      : '📌 No tienes alias de fijos.\nEj: alias fijo 999888777=fijoa+fijob');
  }

  if (arg.indexOf('borrar ') === 0) {
    const clave = normalizarTextoClave_(arg.slice(7)).replace(/\s+/g, '');
    const quedan = reglas.filter(r => claveDe(r) !== clave);
    guardar(quedan);
    return sendMessage(chatId, quedan.length < reglas.length ? '🗑️ Alias borrado.' : 'No encontré ese alias.');
  }

  const partes = arg.split('=');
  const texto = (partes[0] || '').trim();
  const nombres = (partes[1] || '').split('+').map(n => n.trim()).filter(Boolean);
  if (partes.length !== 2 || normalizarTextoClave_(texto).replace(/\s+/g, '').length < 3 || !nombres.length) {
    return sendMessage(chatId, '❌ Formato: alias fijo <texto del correo>=<fijo>+<fijo>\nEj: alias fijo 999888777=fijoa+fijob');
  }

  let existentes = [];
  try { existentes = leerFijos_(chatId).map(f => normalizarTextoClave_(f.nombre).replace(/\s+/g, '')); } catch (err) {}
  const faltan = nombres.filter(n => existentes.length && existentes.indexOf(normalizarTextoClave_(n).replace(/\s+/g, '')) === -1);

  const regla = texto + '=' + nombres.join('+');
  guardar(reglas.filter(r => claveDe(r) !== claveDe(regla)).concat(regla));
  return sendMessage(chatId, '✅ Alias guardado: ' + regla +
    (faltan.length ? '\n⚠️ No encontré estos fijos: ' + faltan.join(', ') + '. Revisa con "fijos".' : ''));
}


// ---- COMANDOS DESDE TELEGRAM --------------------------------
//   probar gmail   -> envia el aviso de tu ultimo consumo (probarAvisoGmail)
//   revisar gmail  -> revisa ahora los correos nuevos (revisarGastosGmail)
//   activar gmail  -> crea el trigger cada 10 min (setupTriggerGmail)
function cmdGmail_(chatId, accion) {
  if (String(chatId) !== String(gmailChatId_())) {
    return sendMessage(chatId, '⛔ Este comando solo funciona en tu chat principal.');
  }
  try {
    if (accion === 'probar') {
      if (!probarAvisoGmail()) sendMessage(chatId, 'No encontré consumos sin procesar en los últimos 30 días.');
      return;
    }
    if (accion === 'revisar') {
      procesarCorreosNuevosGmail_();
      return sendMessage(chatId, '📬 Revisé tus correos. Si había gastos nuevos, ya te llegaron arriba.');
    }
    if (accion === 'activar') {
      setupTriggerGmail();
      return sendMessage(chatId, '✅ Lector de Gmail activo: reviso tus correos cada 10 minutos.');
    }
  } catch (err) {
    sendMessage(chatId, '❌ Error en Gmail: ' + err);
  }
}
