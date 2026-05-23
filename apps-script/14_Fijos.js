// ---- GASTOS FIJOS ------------------------------------------

function cmdFijos(chatId, text) {
  const parts = text.split(' ');
  const cmd = parts[0];

  if (cmd === 'fijos') return mostrarFijos(chatId);

  if (cmd === 'pagar' && parts[1] === 'fijo') {
    return pagarFijo(chatId, parts.slice(2).join(' '));
  }

  if (cmd === 'saltar' && parts[1] === 'fijo') {
    return saltarFijo(chatId, parts.slice(2).join(' '));
  }

  if (cmd === 'eliminar' && parts[1] === 'fijo') {
    return confirmarEliminarFijo(chatId, parts.slice(2).join(' '));
  }

  if (cmd === 'confirmar' && parts[1] === 'eliminar' && parts[2] === 'fijo') {
    return eliminarFijo(chatId, parts.slice(3).join(' '));
  }

  if (cmd === 'fijo') {
    return guardarFijo_(chatId, parts);
  }

  return sendMessage(chatId, '❌ No entendí el comando de gasto fijo. Escribe *ayuda* para ver ejemplos.', true);
}

function asegurarColumnasFijos_(sheet) {
  if (!sheet) return;

  const headers = ['ChatID', 'Nombre', 'Monto', 'Categoría', 'Moneda'];
  for (let i = 0; i < headers.length; i++) {
    const col = i + 1;
    const value = String(sheet.getRange(1, col).getValue() || '').trim();
    if (!value) sheet.getRange(1, col).setValue(headers[i]);
  }

  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
}

function guardarFijo_(chatId, parts) {
  const nombre = parts[1];
  const monto = parseFloat(String(parts[2] || '').replace(',', '.'));
  const monedaInfo = extraerMonedaDeTexto_(parts.slice(3).join(' '));
  const moneda = monedaInfo.moneda || 'PEN';
  const catTexto = String(monedaInfo.texto || 'servicios').trim().split(/\s+/)[0] || 'servicios';
  const cat = normalizarCat(catTexto, nombre, chatId);

  if (!nombre || isNaN(monto) || monto <= 0) {
    return sendMessage(chatId,
      '❌ Formato: *fijo [nombre] [monto] [moneda opcional] [categoría]*\n' +
      'Ej: `fijo alquiler 1500 servicios`\n' +
      'Ej: `fijo netflix 15 USD entretenimiento`', true);
  }

  const sheet = getOrCreateSheet('Fijos', ['ChatID', 'Nombre', 'Monto', 'Categoría', 'Moneda']);
  asegurarColumnasFijos_(sheet);
  const data = sheet.getDataRange().getValues().slice(1);
  const idx = data.findIndex(r =>
    String(r[0]) === String(chatId) &&
    String(r[1]).toLowerCase() === nombre.toLowerCase()
  );

  if (idx >= 0) {
    sheet.getRange(idx + 2, 3, 1, 3).setValues([[monto, cat.toLowerCase(), moneda]]);
    guardarFijoD1({ chatId: chatId, nombre: nombre, monto: monto, cat: cat, currency: moneda, active: true });
    return sendMessage(chatId,
      `✅ *Gasto fijo actualizado*\n\n` +
      `📌 ${capitalizar(nombre)}\n` +
      `💵 ${formatoMoneda_(monto, moneda)}\n` +
      `🏷️ ${capitalizar(cat)}`, true);
  }

  sheet.appendRow([chatId, nombre.toLowerCase(), monto, cat.toLowerCase(), moneda]);
  guardarFijoD1({ chatId: chatId, nombre: nombre, monto: monto, cat: cat, currency: moneda, active: true });
  return sendMessage(chatId,
    `✅ *Gasto fijo registrado*\n\n` +
    `📌 ${capitalizar(nombre)}\n` +
    `💵 ${formatoMoneda_(monto, moneda)}\n` +
    `🏷️ ${capitalizar(cat)}\n\n` +
    `_Se registrará automáticamente el 1ro de cada mes._\n` +
    `_Para marcarlo pagado: \`pagar fijo ${nombre}\`_\n` +
    `_Para saltarlo un mes: \`saltar fijo ${nombre}\`_`, true);
}

function mostrarFijos(chatId) {
  const fijos = leerFijos_(chatId);
  sincronizarFijosD1_(fijos);

  if (!fijos.length) {
    return sendMessage(chatId,
      '📭 No tienes gastos fijos.\n\nAgrega uno:\n`fijo alquiler 1500 servicios`', true);
  }

  const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const total = resumenTotalFijos_(fijos);
  const lineas = fijos.map(item => {
    const estado = fijoYaRegistradoEnMes_(chatId, item, mes) ? '✅ pagado' : '⏳ pendiente';
    return `• ${capitalizar(item.nombre)} — ${formatoMoneda_(item.monto, item.currency)} _(${capitalizar(item.cat)}, ${estado})_`;
  }).join('\n');

  return sendMessage(chatId,
    `🔁 *Gastos fijos mensuales*\n\n${lineas}\n\n` +
    `─────────────────\n` +
    `💸 Total: ${total}/mes\n\n` +
    `_Usa \`pagar fijo nombre\` cuando ya lo pagaste._`, true);
}

function pagarFijo(chatId, nombre) {
  const fijo = buscarFijo_(chatId, nombre);

  if (!fijo) {
    return sendMessage(chatId,
      `❌ No encontré el gasto fijo *${nombre}*.\nEscribe \`fijos\` para ver los activos.`, true);
  }

  const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  if (fijoYaRegistradoEnMes_(chatId, fijo, mes)) {
    return sendMessage(chatId,
      `✅ *${capitalizar(fijo.nombre)}* ya figura como pagado en ${mes}.\nNo dupliqué el gasto.`, true);
  }

  registrarFijoComoTransaccion_(chatId, fijo, 'telegram_fixed_paid');

  return sendMessage(chatId,
    `✅ *Gasto fijo pagado*\n\n` +
    `📌 ${capitalizar(fijo.nombre)}\n` +
    `💵 ${formatoMoneda_(fijo.monto, fijo.currency)}\n` +
    `🏷️ ${capitalizar(fijo.cat)}\n\n` +
    `_Quedó registrado como gasto de ${mes}._`, true);
}

function saltarFijo(chatId, nombre) {
  const fijo = buscarFijo_(chatId, nombre);

  if (!fijo) {
    return sendMessage(chatId,
      `❌ No encontré el gasto fijo *${nombre}*.\nEscribe \`fijos\` para ver los activos.`, true);
  }

  const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  CacheService.getScriptCache()
    .put(`skip_fijo_${chatId}_${fijo.nombre.toLowerCase()}_${mes}`, '1', 60 * 60 * 24 * 30);

  return sendMessage(chatId,
    `⏭️ *Gasto fijo saltado este mes*\n\n` +
    `📌 ${capitalizar(fijo.nombre)} — ${formatoMoneda_(fijo.monto, fijo.currency)}\n\n` +
    `_No se registrará en ${mes}. El próximo mes vuelve a la normalidad._`, true);
}

function confirmarEliminarFijo(chatId, nombre) {
  const fijo = buscarFijo_(chatId, nombre);

  if (!fijo) {
    return sendMessage(chatId,
      `❌ No encontré el gasto fijo *${nombre}*.\nEscribe \`fijos\` para ver los activos.`, true);
  }

  return sendMessage(chatId,
    `⚠️ *¿Eliminar gasto fijo permanentemente?*\n\n` +
    `📌 ${capitalizar(fijo.nombre)} — ${formatoMoneda_(fijo.monto, fijo.currency)}/mes\n\n` +
    `Si confirmas, no se registrará más en meses futuros.\n\n` +
    `✅ Confirmar: \`confirmar eliminar fijo ${fijo.nombre}\`\n` +
    `❌ Cancelar: ignora este mensaje`, true);
}

function eliminarFijo(chatId, nombre) {
  const sheet = getOrCreateSheet('Fijos', ['ChatID', 'Nombre', 'Monto', 'Categoría']);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(chatId) &&
        String(data[i][1]).toLowerCase() === nombre.toLowerCase()) {
      sheet.deleteRow(i + 1);
      eliminarFijoD1(chatId, nombre);
      return sendMessage(chatId,
        `🗑️ *Gasto fijo eliminado*\n\n` +
        `📌 ${capitalizar(nombre)} ya no se registrará automáticamente.`, true);
    }
  }

  return sendMessage(chatId, `❌ No encontré el gasto fijo *${nombre}*.`, true);
}

function registrarGastosFijos() {
  const fijosSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Fijos');
  if (!fijosSheet || fijosSheet.getLastRow() < 2) return;

  const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const porChat = {};

  leerTodosLosFijos_().forEach(fijo => {
    if (fijoEstaSaltado_(fijo.chatId, fijo, mes)) return;
    if (fijoYaRegistradoEnMes_(fijo.chatId, fijo, mes)) return;

    registrarFijoComoTransaccion_(fijo.chatId, fijo, 'telegram_fixed');
    if (!porChat[fijo.chatId]) porChat[fijo.chatId] = [];
    porChat[fijo.chatId].push(fijo);
  });

  Object.entries(porChat).forEach(([chatId, fijos]) => {
    const total = resumenTotalFijos_(fijos);
    const lineas = fijos
      .map(fijo => `• ${capitalizar(fijo.nombre)}: ${formatoMoneda_(fijo.monto, fijo.currency)}`)
      .join('\n');

    sendMessage(chatId,
      `🔁 *Gastos fijos del mes registrados*\n\n${lineas}\n\n` +
      `─────────────────\n` +
      `💸 Total descontado: ${total}`, true);
  });
}

function resumenTotalFijos_(fijos) {
  const totalPen = fijos
    .filter(fijo => fijo.currency !== 'USD')
    .reduce((acc, fijo) => acc + fijo.monto, 0);
  const totalUsd = fijos
    .filter(fijo => fijo.currency === 'USD')
    .reduce((acc, fijo) => acc + fijo.monto, 0);

  const partes = [];
  if (totalPen > 0) partes.push(formatoMoneda_(totalPen, 'PEN'));
  if (totalUsd > 0) partes.push(formatoMoneda_(totalUsd, 'USD'));
  return partes.length ? partes.join(' + ') : formatoMoneda_(0, 'PEN');
}

function sincronizarFijosD1_(fijos) {
  (fijos || []).forEach(fijo => guardarFijoD1(fijo));
}

function leerFijos_(chatId) {
  const d1 = leerDashboardD1_(chatId);
  if (d1 && d1.ok) {
    return (d1.fijos || []).map(item => ({
      chatId: String(chatId),
      nombre: String(item.nombre || '').trim(),
      monto: Number(item.monto || 0),
      cat: normalizarCatBasica_(item.cat || 'servicios'),
      currency: normalizarMoneda_(item.currency) || 'PEN',
    })).filter(fijo => fijo.nombre && fijo.monto > 0);
  }

  return leerTodosLosFijos_()
    .filter(fijo => String(fijo.chatId) === String(chatId));
}

function leerTodosLosFijos_() {
  const sheet = getOrCreateSheet('Fijos', ['ChatID', 'Nombre', 'Monto', 'Categoría', 'Moneda']);
  asegurarColumnasFijos_(sheet);

  return sheet.getDataRange().getValues().slice(1)
    .map(r => ({
      chatId: String(r[0] || ''),
      nombre: String(r[1] || '').trim(),
      monto: parseFloat(r[2]) || 0,
      cat: normalizarCat(r[3] || 'servicios', r[1], r[0]),
      currency: normalizarMoneda_(r[4]) || 'PEN',
    }))
    .filter(fijo => fijo.chatId && fijo.nombre && fijo.monto > 0);
}

function buscarFijo_(chatId, nombre) {
  return leerFijos_(chatId).find(fijo =>
    fijo.nombre.toLowerCase() === String(nombre || '').trim().toLowerCase()
  );
}

function fijoYaRegistradoEnMes_(chatId, fijo, mes) {
  return obtenerTransacciones(chatId).some(r => {
    const fechaMes = Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM');
    return fechaMes === mes &&
      r[2] === 'gasto' &&
      String(r[3]).toLowerCase() === capitalizar(fijo.nombre).toLowerCase();
  });
}

function fijoEstaSaltado_(chatId, fijo, mes) {
  const key = `skip_fijo_${chatId}_${fijo.nombre.toLowerCase()}_${mes}`;
  return CacheService.getScriptCache().get(key) === '1';
}

function registrarFijoComoTransaccion_(chatId, fijo, source) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const txSheet = ss.getSheetByName('Transacciones') || crearHojaTransacciones();
  asegurarColumnasPagoTransacciones_(txSheet);
  const fecha = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
  const hora = Utilities.formatDate(new Date(), 'America/Lima', 'HH:mm');
  const desc = capitalizar(fijo.nombre);
  const cat = normalizarCat(fijo.cat, fijo.nombre, chatId);
  const currency = normalizarMoneda_(fijo.currency || fijo.moneda) || 'PEN';

  txSheet.appendRow([fecha, hora, 'gasto', desc, cat, fijo.monto, chatId, 'debito', '', '', currency]);
  guardarTransaccionD1({
    chatId: chatId,
    fecha: fecha,
    hora: hora,
    tipo: 'gasto',
    desc: desc,
    cat: cat,
    monto: fijo.monto,
    currency: currency,
    paymentMethod: 'debito',
    source: source,
  });
}
