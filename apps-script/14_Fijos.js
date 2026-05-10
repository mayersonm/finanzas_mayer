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

function guardarFijo_(chatId, parts) {
  const nombre = parts[1];
  const monto = parseFloat(parts[2]);
  const cat = normalizarCat(parts[3] || 'servicios', nombre);

  if (!nombre || isNaN(monto) || monto <= 0) {
    return sendMessage(chatId,
      '❌ Formato: *fijo [nombre] [monto] [categoría]*\n' +
      'Ej: `fijo alquiler 1500 servicios`', true);
  }

  const sheet = getOrCreateSheet('Fijos', ['ChatID', 'Nombre', 'Monto', 'Categoría']);
  const data = sheet.getDataRange().getValues().slice(1);
  const idx = data.findIndex(r =>
    String(r[0]) === String(chatId) &&
    String(r[1]).toLowerCase() === nombre.toLowerCase()
  );

  if (idx >= 0) {
    sheet.getRange(idx + 2, 3, 1, 2).setValues([[monto, cat.toLowerCase()]]);
    return sendMessage(chatId,
      `✅ *Gasto fijo actualizado*\n\n` +
      `📌 ${capitalizar(nombre)}\n` +
      `💵 S/ ${monto.toFixed(2)}\n` +
      `🏷️ ${capitalizar(cat)}`, true);
  }

  sheet.appendRow([chatId, nombre.toLowerCase(), monto, cat.toLowerCase()]);
  return sendMessage(chatId,
    `✅ *Gasto fijo registrado*\n\n` +
    `📌 ${capitalizar(nombre)}\n` +
    `💵 S/ ${monto.toFixed(2)}\n` +
    `🏷️ ${capitalizar(cat)}\n\n` +
    `_Se registrará automáticamente el 1ro de cada mes._\n` +
    `_Para marcarlo pagado: \`pagar fijo ${nombre}\`_\n` +
    `_Para saltarlo un mes: \`saltar fijo ${nombre}\`_`, true);
}

function mostrarFijos(chatId) {
  const fijos = leerFijos_(chatId);

  if (!fijos.length) {
    return sendMessage(chatId,
      '📭 No tienes gastos fijos.\n\nAgrega uno:\n`fijo alquiler 1500 servicios`', true);
  }

  const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const total = fijos.reduce((acc, item) => acc + item.monto, 0);
  const lineas = fijos.map(item => {
    const estado = fijoYaRegistradoEnMes_(chatId, item, mes) ? '✅ pagado' : '⏳ pendiente';
    return `• ${capitalizar(item.nombre)} — S/ ${item.monto.toFixed(2)} _(${capitalizar(item.cat)}, ${estado})_`;
  }).join('\n');

  return sendMessage(chatId,
    `🔁 *Gastos fijos mensuales*\n\n${lineas}\n\n` +
    `─────────────────\n` +
    `💸 Total: S/ ${total.toFixed(2)}/mes\n\n` +
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
    `💵 S/ ${fijo.monto.toFixed(2)}\n` +
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
    `📌 ${capitalizar(fijo.nombre)} — S/ ${fijo.monto.toFixed(2)}\n\n` +
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
    `📌 ${capitalizar(fijo.nombre)} — S/ ${fijo.monto.toFixed(2)}/mes\n\n` +
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
    const total = fijos.reduce((acc, fijo) => acc + fijo.monto, 0);
    const lineas = fijos
      .map(fijo => `• ${capitalizar(fijo.nombre)}: S/ ${fijo.monto.toFixed(2)}`)
      .join('\n');

    sendMessage(chatId,
      `🔁 *Gastos fijos del mes registrados*\n\n${lineas}\n\n` +
      `─────────────────\n` +
      `💸 Total descontado: S/ ${total.toFixed(2)}`, true);
  });
}

function leerFijos_(chatId) {
  return leerTodosLosFijos_()
    .filter(fijo => String(fijo.chatId) === String(chatId));
}

function leerTodosLosFijos_() {
  const sheet = getOrCreateSheet('Fijos', ['ChatID', 'Nombre', 'Monto', 'Categoría']);

  return sheet.getDataRange().getValues().slice(1)
    .map(r => ({
      chatId: String(r[0] || ''),
      nombre: String(r[1] || '').trim(),
      monto: parseFloat(r[2]) || 0,
      cat: normalizarCat(r[3] || 'servicios', r[1]),
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
  const fecha = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
  const hora = Utilities.formatDate(new Date(), 'America/Lima', 'HH:mm');
  const desc = capitalizar(fijo.nombre);
  const cat = normalizarCat(fijo.cat, fijo.nombre);

  txSheet.appendRow([fecha, hora, 'gasto', desc, cat, fijo.monto, chatId]);
  guardarTransaccionD1({
    chatId: chatId,
    fecha: fecha,
    hora: hora,
    tipo: 'gasto',
    desc: desc,
    cat: cat,
    monto: fijo.monto,
    source: source,
  });
}
