// ---- FORMA DE PAGO -----------------------------------------
// Soporta una tarjeta de credito por defecto.
// Configuracion: credito configurar corte 25 pago 10

function resolverPagoMovimiento_(tipo, descripcion, fecha) {
  const extraido = extraerMetodoPagoTexto_(descripcion);
  const metodo = tipo === 'gasto'
    ? (extraido.metodo || metodoPagoPorDefecto_())
    : '';

  return construirPago_(metodo, fecha, extraido.texto, '');
}

function resolverPagoRecibo_(datos, fecha) {
  const metodo = normalizarMetodoPago_(
    datos.metodo_pago ||
    datos.metodoPago ||
    datos.forma_pago ||
    datos.formaPago ||
    datos.pago ||
    ''
  ) || metodoPagoPorDefecto_();

  return construirPago_(metodo, fecha, '', datos.tarjeta || datos.card || '');
}

function construirPago_(metodoRaw, fecha, descripcion, tarjetaRaw) {
  const metodo = normalizarMetodoPago_(metodoRaw) || 'debito';
  const config = obtenerConfigCredito_();
  const tarjeta = metodo === 'credito'
    ? String(tarjetaRaw || config.cardName || 'Tarjeta credito').trim()
    : '';
  const vencimiento = metodo === 'credito'
    ? calcularFechaPagoCredito_(fecha)
    : { configured: true, fechaPago: '' };

  return {
    metodo: metodo,
    fechaPago: vencimiento.fechaPago || '',
    tarjeta: tarjeta,
    descripcion: String(descripcion || '').trim(),
    creditoConfigurado: vencimiento.configured,
    corteDia: config.cutoffDay,
    pagoDia: config.dueDay,
  };
}

function metodoPagoPorDefecto_() {
  return normalizarMetodoPago_(
    PropertiesService.getScriptProperties().getProperty('default_payment_method')
  ) || 'debito';
}

function normalizarMetodoPago_(value) {
  const key = normalizarTextoClave_(value);
  if (!key || key === 'desconocido' || key === 'unknown') return '';

  if (/\b(credito|credit|tc)\b/.test(key)) return 'credito';
  if (/\b(debito|debit|td|efectivo|cash|yape|plin|transferencia)\b/.test(key)) return 'debito';

  return '';
}

function extraerMetodoPagoTexto_(text) {
  let limpio = String(text || '').trim();
  const metodo = normalizarMetodoPago_(limpio);

  if (!metodo) {
    return { metodo: '', texto: limpio };
  }

  limpio = limpio
    .replace(/\b(?:tarjeta\s+de\s+credito|tarjeta\s+credito|credito|crédito|tc)\b/ig, ' ')
    .replace(/\b(?:tarjeta\s+de\s+debito|tarjeta\s+debito|debito|débito|td|efectivo|cash|yape|plin|transferencia)\b/ig, ' ')
    .replace(/\b(?:con|por|pago|pagado|tarjeta|de)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { metodo: metodo, texto: limpio };
}

function obtenerConfigCredito_() {
  const props = PropertiesService.getScriptProperties();
  return {
    cutoffDay: limitarDiaPago_(props.getProperty('credit_cutoff_day') || props.getProperty('credito_corte_dia')),
    dueDay: limitarDiaPago_(props.getProperty('credit_due_day') || props.getProperty('credito_pago_dia')),
    cardName: String(props.getProperty('credit_card_name') || props.getProperty('credito_tarjeta') || '').trim(),
  };
}

function calcularFechaPagoCredito_(fecha) {
  const config = obtenerConfigCredito_();
  if (!config.cutoffDay || !config.dueDay) {
    return { configured: false, fechaPago: '' };
  }

  const base = fechaLocalPago_(fecha);
  const closeMonthOffset = base.getDate() <= config.cutoffDay ? 0 : 1;
  const closeMonth = new Date(base.getFullYear(), base.getMonth() + closeMonthOffset, 1);
  const dueMonthOffset = config.dueDay > config.cutoffDay ? 0 : 1;
  const dueMonth = new Date(closeMonth.getFullYear(), closeMonth.getMonth() + dueMonthOffset, 1);
  const dueDay = Math.min(config.dueDay, ultimoDiaMes_(dueMonth.getFullYear(), dueMonth.getMonth()));
  const dueDate = new Date(dueMonth.getFullYear(), dueMonth.getMonth(), dueDay);

  return {
    configured: true,
    fechaPago: Utilities.formatDate(dueDate, 'America/Lima', 'yyyy-MM-dd'),
  };
}

function fechaLocalPago_(fecha) {
  if (Object.prototype.toString.call(fecha) === '[object Date]') return fecha;

  const text = String(fecha || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  return new Date();
}

function ultimoDiaMes_(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function limitarDiaPago_(value) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1 || n > 31) return 0;
  return n;
}

function lineasPagoMensaje_(pago) {
  if (!pago || !pago.metodo) return '';

  if (pago.metodo === 'credito') {
    if (pago.fechaPago) {
      return `💳 Credito\n⏰ Pagar hasta: *${pago.fechaPago}*`;
    }

    return '💳 Credito\n⚠️ Configura corte y pago: `credito configurar corte 25 pago 10`';
  }

  return '💳 Debito';
}

function cmdCredito(chatId, text) {
  if (!puedeConfigurarPago_(chatId)) {
    return sendMessage(chatId, 'No tienes permiso para cambiar la configuracion de credito.', true);
  }

  const clean = String(text || '').trim();
  const match = clean.match(/^(?:credito|crédito|tarjeta)(?:\s+configurar)?\s+(?:corte|cierre)\s+(\d{1,2})\s+pago\s+(\d{1,2})(?:\s+(.+))?$/i);

  if (match) {
    const corte = limitarDiaPago_(match[1]);
    const pago = limitarDiaPago_(match[2]);
    const tarjeta = String(match[3] || '').trim();

    if (!corte || !pago) {
      return sendMessage(chatId, '❌ Usa dias del 1 al 31. Ej: `credito configurar corte 25 pago 10`', true);
    }

    const props = PropertiesService.getScriptProperties();
    props.setProperty('credit_cutoff_day', String(corte));
    props.setProperty('credit_due_day', String(pago));
    if (tarjeta) props.setProperty('credit_card_name', tarjeta);

    return sendMessage(
      chatId,
      `✅ *Credito configurado*\n\n` +
      `📌 Corte: dia *${corte}*\n` +
      `⏰ Pago: dia *${pago}*\n` +
      (tarjeta ? `💳 Tarjeta: *${tarjeta}*\n\n` : '\n') +
      `Ejemplo de gasto:\n` +
      '`gasto 120 supermercado metro credito`',
      true
    );
  }

  const config = obtenerConfigCredito_();
  return sendMessage(
    chatId,
    `💳 *Credito*\n\n` +
    (config.cutoffDay && config.dueDay
      ? `📌 Corte: dia *${config.cutoffDay}*\n⏰ Pago: dia *${config.dueDay}*\n`
      : '⚠️ Aun no tienes corte y pago configurados.\n') +
    (config.cardName ? `💳 Tarjeta: *${config.cardName}*\n` : '') +
    `\nConfigurar:\n` +
    '`credito configurar corte 25 pago 10`\n\n' +
    `Corregir un movimiento:\n` +
    '`pago ultimo credito` o `pago 1 debito`',
    true
  );
}

function cmdPago(chatId, text) {
  const match = String(text || '').trim().match(/^(?:pago|metodo|método)\s+(ultimo|último|last|\d+)\s+(.+)$/i);
  if (!match) {
    return sendMessage(chatId, '❌ Formato: `pago ultimo credito` o `pago 1 debito`.\n\nUsa `ultimos` para ver la numeracion.', true);
  }

  const metodo = normalizarMetodoPago_(match[2]);
  if (!metodo) {
    return sendMessage(chatId, '❌ Metodo no valido. Usa `debito` o `credito`.', true);
  }

  const ultimos = obtenerUltimosConFila_(chatId, 5);
  if (!ultimos.length) {
    return sendMessage(chatId, '📭 No tienes movimientos para corregir.', true);
  }

  const ref = String(match[1]).toLowerCase();
  const index = (ref === 'ultimo' || ref === 'último' || ref === 'last')
    ? 0
    : parseInt(ref, 10) - 1;

  if (isNaN(index) || index < 0 || index >= ultimos.length) {
    return sendMessage(chatId, '❌ Ese numero no esta en `ultimos`. Ej: `pago 1 credito`.', true);
  }

  const item = ultimos[index];
  const row = item.values;
  const fecha = formatearFechaTx_(row[0]);
  const hora = formatearHoraTx_(row[1]);
  const tipo = String(row[2] || 'gasto').toLowerCase();
  const desc = String(row[3] || 'Sin descripcion');
  const cat = String(row[4] || 'otro').toLowerCase();
  const monto = parseFloat(row[5]) || 0;
  const pago = construirPago_(metodo, fecha, '', '');

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones');
  asegurarColumnasPagoTransacciones_(sheet);
  sheet.getRange(item.rowNumber, 8, 1, 3).setValues([[
    pago.metodo,
    pago.fechaPago,
    pago.tarjeta,
  ]]);

  const d1Ok = actualizarPagoD1({
    chatId: chatId,
    fecha: fecha,
    hora: hora,
    tipo: tipo,
    desc: desc,
    cat: cat,
    monto: monto,
    paymentMethod: pago.metodo,
    paymentDueDate: pago.fechaPago,
    cardName: pago.tarjeta,
  });

  return sendMessage(
    chatId,
    `💳 *Forma de pago actualizada*\n\n` +
    `${desc}\n` +
    `${lineasPagoMensaje_(pago)}\n\n` +
    (d1Ok ? `_Actualizado en Sheets y D1._` : `_Actualizado en Sheets. D1 no respondio, revisa el log._`),
    true
  );
}

function puedeConfigurarPago_(chatId) {
  const ownerChatId = PropertiesService.getScriptProperties().getProperty('dashboard_chat_id');
  return !ownerChatId || String(chatId) === String(ownerChatId);
}
