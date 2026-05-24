// ---- REGISTRAR MOVIMIENTO ----------------------------------

function registrarMovimiento(chatId, match, originalText) {
    const tipo = match[1];
    const monto = parseFloat(match[2].replace(',', '.'));
    const monedaDirecta = normalizarMoneda_(match[3]);
    const catTexto = match[4];
    const descTexto = match[5] || '';
    const monedaInfo = extraerMonedaDeTexto_(descTexto);
    const moneda = monedaDirecta || monedaInfo.moneda;
    const fecha = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
    const hora = Utilities.formatDate(new Date(), 'America/Lima', 'HH:mm');
    const pago = resolverPagoMovimiento_(tipo, monedaInfo.texto || '', fecha);
    const cat = normalizarCat(catTexto, pago.descripcion || monedaInfo.texto, chatId);
    const desc = pago.descripcion
        ? capitalizar(pago.descripcion)
        : capitalizar(cat);

    if (isNaN(monto) || monto <= 0) {
        return sendMessage(chatId, '❌ El monto debe ser un número positivo. Ej: *gasto 45.50 supermercado almuerzo*', true);
    }

    if (monedaInfo.error || !moneda) {
        return sendMessage(chatId, monedaInfo.error || '❌ Solo acepto moneda *PEN* o *USD*.', true);
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones')
        || crearHojaTransacciones();

    asegurarColumnasPagoTransacciones_(sheet);
    sheet.appendRow([fecha, hora, tipo, desc, cat.toLowerCase(), monto, chatId, pago.metodo, pago.fechaPago, pago.tarjeta, moneda]);
    const d1Ok = guardarTransaccionD1({
        chatId: chatId,
        fecha: fecha,
        hora: hora,
        tipo: tipo,
        desc: desc,
        cat: cat,
        monto: monto,
        currency: moneda,
        paymentMethod: pago.metodo,
        paymentDueDate: pago.fechaPago,
        cardName: pago.tarjeta,
        source: 'telegram_text',
    });
    

    const emoji = tipo === 'gasto' ? '📤' : '📥';
    const color = tipo === 'gasto' ? '🔴' : '🟢';

    sendMessage(chatId,
        `${emoji} *¡Registrado!*

` +
        `${color} ${desc}
` +
        `💵 ${formatoMoneda_(monto, moneda)}
` +
        `🏷️ ${capitalizar(cat)}
` +
        `${lineasPagoMensaje_(pago)}
` +
        `📅 ${fecha}

` +
        `_Escribe *balance* para ver tu saldo._` +
        (d1Ok ? '' : '\n\n⚠️ Guardado en Sheets, pero D1 no respondió. El dashboard puede no verlo al instante.'),
        true
    );
    // Alerta si supera el presupuesto de esta categoría
    if (tipo === 'gasto') verificarPresupuesto(chatId, cat);
}

// ---- CORREGIR CATEGORIA ------------------------------------
// Ejemplos:
//   categoria ultimo supermercado
//   categoria 1 supermercado
// Usa la numeracion que muestra el comando "ultimos".
function cmdCategoria(chatId, text) {
    const match = String(text || '').match(/^(?:categoria|cat)\s+(ultimo|último|last|\d+)\s+(.+)$/i);
    if (!match) {
        return sendMessage(
            chatId,
            '❌ Formato: `categoria ultimo supermercado` o `categoria 1 supermercado`.\n\nUsa `ultimos` para ver la numeración.',
            true
        );
    }

    const ref = String(match[1]).toLowerCase();
    const nuevaCat = normalizarCat(match[2], '', chatId);
    if (!nuevaCat) {
        return sendMessage(chatId, '❌ Categoria no valida.', true);
    }

    const ultimos = obtenerUltimosConFila_(chatId, 5);
    if (!ultimos.length) {
        return sendMessage(chatId, '📭 No tienes movimientos para corregir.', true);
    }

    const index = (ref === 'ultimo' || ref === 'último' || ref === 'last')
        ? 0
        : parseInt(ref, 10) - 1;

    if (isNaN(index) || index < 0 || index >= ultimos.length) {
        return sendMessage(chatId, '❌ Ese número no está en `ultimos`. Ej: `categoria 1 supermercado`.', true);
    }

    const item = ultimos[index];
    const row = item.values;
    const anterior = String(row[4] || 'otro').toLowerCase();

    if (anterior === nuevaCat) {
        return sendMessage(chatId, `🏷️ Ese movimiento ya está en *${capitalizar(nuevaCat)}*.`, true);
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones');
    sheet.getRange(item.rowNumber, 5).setValue(nuevaCat);

    const fecha = formatearFechaTx_(row[0]);
    const hora = formatearHoraTx_(row[1]);
    const tipo = String(row[2] || 'gasto').toLowerCase();
    const desc = String(row[3] || 'Sin descripcion');
    const monto = parseFloat(row[5]) || 0;
    const moneda = normalizarMoneda_(row[10]) || 'PEN';

    const d1Ok = actualizarCategoriaD1({
        chatId: chatId,
        fecha: fecha,
        hora: hora,
        tipo: tipo,
        desc: desc,
        oldCat: anterior,
        cat: nuevaCat,
        monto: monto,
        currency: moneda,
    });

    if (tipo === 'gasto') verificarPresupuesto(chatId, nuevaCat);

    return sendMessage(
        chatId,
        `🏷️ *Categoria actualizada*\n\n` +
        `${desc}\n` +
        `${capitalizar(anterior)} → *${capitalizar(nuevaCat)}*\n` +
        `${formatoMoneda_(monto, moneda)}\n\n` +
        (d1Ok ? `_Actualizado en Sheets y D1._` : `_Actualizado en Sheets. D1 no respondio, revisa el log._`),
        true
    );
}

// ---- ELIMINAR MOVIMIENTO -----------------------------------
// Ejemplos:
//   eliminar ultimo
//   eliminar 1
// Usa la numeracion que muestra el comando "ultimos".
function cmdEliminarMovimiento(chatId, text) {
    const match = String(text || '').match(/^(?:eliminar|borrar)\s+(ultimo|último|last|\d+)$/i);
    if (!match) {
        return sendMessage(
            chatId,
            '❌ Formato: `eliminar ultimo` o `eliminar 1`.\n\nUsa `ultimos` para ver la numeración.',
            true
        );
    }

    const ultimos = obtenerUltimosConFila_(chatId, 5);
    if (!ultimos.length) {
        return sendMessage(chatId, '📭 No tienes movimientos para eliminar.', true);
    }

    const ref = String(match[1]).toLowerCase();
    const index = (ref === 'ultimo' || ref === 'último' || ref === 'last')
        ? 0
        : parseInt(ref, 10) - 1;

    if (isNaN(index) || index < 0 || index >= ultimos.length) {
        return sendMessage(chatId, '❌ Ese número no está en `ultimos`. Ej: `eliminar 1`.', true);
    }

    const item = ultimos[index];
    const row = item.values;
    const tx = transaccionDesdeFila_(chatId, row);

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones');
    sheet.deleteRow(item.rowNumber);

    const d1Ok = eliminarTransaccionD1(tx);
    const signo = tx.tipo === 'ingreso' ? '📥' : '📤';

    return sendMessage(
        chatId,
        `🗑️ *Movimiento eliminado*\n\n` +
        `${signo} ${tx.desc}\n` +
        `💵 ${formatoMoneda_(tx.monto, tx.currency)}\n` +
        `🏷️ ${capitalizar(tx.cat)}\n` +
        `📅 ${tx.fecha} ${tx.hora}\n\n` +
        (d1Ok ? `_Eliminado en Sheets y D1._` : `_Eliminado en Sheets. D1 no respondió, puede aparecer temporalmente en el dashboard._`),
        true
    );
}

function transaccionDesdeFila_(chatId, row) {
    return {
        chatId: chatId,
        fecha: formatearFechaTx_(row[0]),
        hora: formatearHoraTx_(row[1]),
        tipo: String(row[2] || 'gasto').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto',
        desc: String(row[3] || 'Sin descripcion'),
        cat: String(row[4] || 'otro').toLowerCase(),
        monto: parseFloat(row[5]) || 0,
        currency: normalizarMoneda_(row[10]) || 'PEN',
    };
}

function obtenerUltimosConFila_(chatId, limit) {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones');
    if (!sheet || sheet.getLastRow() < 2) return [];

    const values = sheet.getDataRange().getValues();
    const rows = [];

    for (let i = 1; i < values.length; i++) {
        if (String(values[i][6]) === String(chatId)) {
            rows.push({ rowNumber: i + 1, values: values[i] });
        }
    }

    return rows.slice(-limit).reverse();
}

function formatearFechaTx_(value) {
    return Utilities.formatDate(new Date(value), 'America/Lima', 'yyyy-MM-dd');
}

function formatearHoraTx_(value) {
    if (Object.prototype.toString.call(value) === '[object Date]') {
        return Utilities.formatDate(value, 'America/Lima', 'HH:mm');
    }

    return String(value || '00:00').slice(0, 5);
}

// ---- PRESUPUESTO MENSUAL -----------------------------------
// Guarda los presupuestos en la hoja "Presupuestos"
// Columnas: ChatID | Categoría | Limite

function cmdPresupuesto(chatId, text) {
    const parts = text.split(' ');

    if (parts.length === 1) return mostrarPresupuestos(chatId);

    const cat = normalizarCat(parts[1], '', chatId);
    const limit = parseFloat(parts[2]);

    if (!cat || isNaN(limit) || limit <= 0) {
        return sendMessage(chatId,
            '❌ Formato: *presupuesto [categoría] [monto]* Ej: presupuesto supermercado 500', true);
    }

    const guardadoD1 = guardarPresupuestoD1_(chatId, cat, limit);
    const sheet = getOrCreateSheet('Presupuestos', ['ChatID', 'Categoría', 'Límite']);
    const data = sheet.getDataRange().getValues();
    const notaD1 = guardadoD1 ? '' : '\n\n⚠️ No pude guardar en D1; quedó solo como respaldo en Sheets.';

    // Actualiza si ya existe, si no agrega fila nueva
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(chatId) && normalizarCat(data[i][1], '', chatId) === cat) {
            sheet.getRange(i + 1, 3).setValue(limit);
            return sendMessage(chatId,
                `✅ Presupuesto actualizado

🏷️ ${capitalizar(cat)}
💰 S/ ${limit.toFixed(2)} / mes${notaD1}`, true);
        }
    }
    sheet.appendRow([chatId, cat, limit]);
    sendMessage(chatId,
        `✅ Presupuesto guardado

🏷️ ${capitalizar(cat)}
💰 S/ ${limit.toFixed(2)} / mes

_Escribe *presupuesto* para ver todos._${notaD1}`, true);
}

function mostrarPresupuestos(chatId) {
    const d1 = leerDashboardD1_(chatId);
    if (d1 && d1.ok) {
        const presupuestosD1 = d1.presupuestos || [];
        if (!presupuestosD1.length) {
            return sendMessage(chatId,
                '📭 No tienes presupuestos en D1. Crea uno: `presupuesto supermercado 500`', true);
        }

        const mesD1 = d1.mesKey || Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
        let msgD1 = `📊 *Presupuestos — ${mesD1}*

`;

        presupuestosD1.forEach(item => {
            const cat = item.cat || 'otro';
            const limite = Number(item.limite || 0);
            const gasto = Number(item.gasto || 0);
            const pct = limite > 0 ? Math.min(Math.round((gasto / limite) * 100), 100) : 0;
            const estado = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
            msgD1 += `${estado} *${capitalizar(cat)}*
`;
            msgD1 += `${buildBar(pct)} ${pct}%
`;
            msgD1 += `S/ ${gasto.toFixed(2)} de S/ ${limite.toFixed(2)}

`;
        });

        return sendMessage(chatId, msgD1 + '_Fuente: D1_', true);
    }

    const sheet = getOrCreateSheet('Presupuestos', ['ChatID', 'Categoría', 'Límite']);
    const data = sheet.getDataRange().getValues().slice(1)
        .filter(r => String(r[0]) === String(chatId));

    if (!data.length) {
        return sendMessage(chatId,
            '📭 No tienes presupuestos. Crea uno: `presupuesto supermercado 500`', true);
    }

    const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
    const gastosCat = (obtenerGastosPorMesCat(chatId, mes)[mes]) || {};
    let msg = `📊 *Presupuestos — ${mes}*

`;

    data.forEach(r => {
        const cat = r[1];
        const limite = parseFloat(r[2]);
        const gasto = gastoPresupuestoPorCategoria_(gastosCat, cat, chatId);
        const pct = Math.min(Math.round((gasto / limite) * 100), 100);
        const estado = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
        msg += `${estado} *${capitalizar(cat)}*
`;
        msg += `${buildBar(pct)} ${pct}%
`;
        msg += `S/ ${gasto.toFixed(2)} de S/ ${limite.toFixed(2)}

`;
    });

    sendMessage(chatId, msg, true);
}


function verificarPresupuesto(chatId, cat) {
  const d1 = leerDashboardD1_(chatId);
  const presupuestoD1 = presupuestoD1ParaCategoria_(d1, cat);
  if (presupuestoD1) {
    const presupuestoCat = normalizarCatBasica_(presupuestoD1.cat || cat);
    const limite = Number(presupuestoD1.limite || 0);
    const gasto = Number(presupuestoD1.gasto || 0);
    const pct = limite > 0 ? Math.round((gasto / limite) * 100) : 0;

    if (pct >= 100) {
      sendMessage(chatId,
        `🔴 *¡Presupuesto superado!*\n` +
        `${capitalizar(presupuestoCat)}: S/ ${gasto.toFixed(2)} / S/ ${limite.toFixed(2)}`, true);
    } else if (pct >= 80) {
      sendMessage(chatId,
        `🟡 *Alerta:* llevas el ${pct}% de ${capitalizar(presupuestoCat)}\n` +
        `S/ ${gasto.toFixed(2)} de S/ ${limite.toFixed(2)}`, true);
    }
    return;
  }

  const sheet = getOrCreateSheet('Presupuestos', ['ChatID','Categoría','Límite']);
  const catNormalizada = normalizarCat(cat, '', chatId);
  const fila  = sheet.getDataRange().getValues().slice(1)
    .find(r => String(r[0]) === String(chatId) && categoriasParaPresupuesto_(r[1], chatId).indexOf(catNormalizada) >= 0);

  if (!fila) return;

  const presupuestoCat = normalizarCat(fila[1], '', chatId);
  const limite    = parseFloat(fila[2]);
  const mes       = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const porCat    = (obtenerGastosPorMesCat(chatId, mes)[mes]) || {}; // ← fix
  const gasto     = gastoPresupuestoPorCategoria_(porCat, presupuestoCat, chatId);
  const pct       = Math.round((gasto / limite) * 100);

  if (pct >= 100) {
    sendMessage(chatId,
      `🔴 *¡Presupuesto superado!*\n` +
      `${capitalizar(presupuestoCat)}: S/ ${gasto.toFixed(2)} / S/ ${limite.toFixed(2)}`, true);
  } else if (pct >= 80) {
    sendMessage(chatId,
      `🟡 *Alerta:* llevas el ${pct}% de ${capitalizar(presupuestoCat)}\n` +
      `S/ ${gasto.toFixed(2)} de S/ ${limite.toFixed(2)}`, true);
  }
}

function presupuestoD1ParaCategoria_(d1, cat) {
  if (!d1 || !d1.ok || !d1.presupuestos || !d1.presupuestos.length) return null;

  const catNormalizada = normalizarCatBasica_(cat || 'otro');
  const reglas = d1.budgetRules || [];
  const regla = reglas.find(item =>
    normalizarCatBasica_(item.includedCategory || '') === catNormalizada
  );
  const presupuestoKey = regla ? normalizarCatBasica_(regla.budgetCategory || '') : catNormalizada;

  return d1.presupuestos.find(item =>
    normalizarCatBasica_(item.cat || '') === presupuestoKey
  ) || null;
}


// ---- METAS DE AHORRO ---------------------------------------
// Hoja "Metas": ChatID | Nombre | Objetivo | Ahorrado | Fecha
function cmdMetas(chatId, text) {

    const parts = text.split(' ');
    const objetivo = parseFloat(parts.pop());
    const nombre = parts.slice(1).join(' ').toLowerCase();

    if (!nombre || isNaN(objetivo) || objetivo <= 0) {
        return sendMessage(
            chatId,
            '❌ Formato:\n*meta [nombre] [objetivo]*\nEj: meta viaje europa 3000',
            true
        );
    }

    const sheet = getOrCreateSheet(
        'Metas',
        ['ChatID', 'Nombre', 'Objetivo', 'Ahorrado', 'Creada']
    );

    const data = sheet.getDataRange().getValues().slice(1);

    const existe = data.find(r =>
        String(r[0]) === String(chatId) &&
        r[1].toLowerCase() === nombre
    );

    if (existe) {
        return sendMessage(
            chatId,
            `⚠️ Ya tienes una meta llamada *${capitalizar(nombre)}*.\nUsa *ahorrar ${nombre} [monto]* para sumar.`,
            true
        );
    }

    const fecha = Utilities.formatDate(
        new Date(),
        'America/Lima',
        'yyyy-MM-dd'
    );

    sheet.appendRow([
        chatId,
        capitalizar(nombre),
        objetivo,
        0,
        fecha
    ]);

    sendMessage(
        chatId,
        `🎯 *Meta creada!* 📌 ${capitalizar(nombre)}
         💰 Objetivo: S/ ${objetivo.toFixed(2)}
         Usa: *ahorrar ${nombre} [monto]*`,
        true
    );
}

function cmdAhorrar(chatId, text) {
    const parts = text.trim().split(/\s+/);

    const monto = parseFloat(parts.pop());
    const nombre = parts.slice(1).join(' ').toLowerCase();

    if (!nombre || isNaN(monto) || monto <= 0) {
        return sendMessage(chatId,
            '❌ Formato:\n*ahorrar [meta] [monto]*\nEj: ahorrar viaje 200', true);
    }

    const sheet = getOrCreateSheet('Metas', ['ChatID', 'Nombre', 'Objetivo', 'Ahorrado', 'Creada']);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
        if (
            String(data[i][0]) === String(chatId) &&
            String(data[i][1]).toLowerCase() === nombre
        ) {
            const nuevo = parseFloat(data[i][3]) + monto;
            const objetivo = parseFloat(data[i][2]);

            sheet.getRange(i + 1, 4).setValue(nuevo);

            const pct = Math.min(Math.round((nuevo / objetivo) * 100), 100);
            const completada = nuevo >= objetivo;

            return sendMessage(
                chatId,
                (completada ? `🏆 *¡Meta alcanzada!*\n\n` : `💪 *Ahorro registrado!*\n\n`) +
                `📌 ${capitalizar(nombre)}\n` +
                `${buildBar(pct)} ${pct}%\n\n` +
                `💰 S/ ${nuevo.toFixed(2)} de S/ ${objetivo.toFixed(2)}\n` +
                (completada
                    ? `\n🎉 ¡Lo lograste!`
                    : `\n⏳ Faltan S/ ${(objetivo - nuevo).toFixed(2)}`),
                true
            );
        }
    }

    sendMessage(chatId,
        `❌ No encontré la meta *${capitalizar(nombre)}*.\nEscribe *metas* para ver tus metas.`, true);
}

function mostrarMetas(chatId) {
  const sheet = getOrCreateSheet('Metas', ['ChatID','Nombre','Objetivo','Ahorrado','Creada']);
  const data  = sheet.getDataRange().getValues().slice(1)
    .filter(r => String(r[0]) === chatId);

  if (!data.length) {
    return sendMessage(chatId,
      '📭 No tienes metas de ahorro.\n\nCrea una:\n`meta viaje 3000`', true);
  }

  let msg = `🎯 *Tus metas de ahorro*\n\n`;

  data.forEach(r => {
    const ahorrado = parseFloat(r[3]);
    const objetivo = parseFloat(r[2]);
    const pct      = Math.min(Math.round((ahorrado / objetivo) * 100), 100);
    const faltan   = objetivo - ahorrado;
    const emoji    = pct >= 100 ? '🏆' : pct >= 50 ? '💪' : '🎯';

    msg += `- ${emoji} *${capitalizar(r[1])}*\n`;
    msg += `${buildBar(pct)} ${pct}%\n`;
    msg += `S/ ${ahorrado.toFixed(2)} / S/ ${objetivo.toFixed(2)}\n`;
    msg += pct >= 100
      ? `¡Meta completada! 🎉\n`
      : `Faltan S/ ${faltan.toFixed(2)}\n`;
    msg += `\n`;
  });

  sendMessage(chatId, msg, true);
}


// ---- HELPERS -----------------------------------------------

function gastosDelMesPorCat(chatId, mes) {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones');
    if (!sheet) return {};
    const data = sheet.getDataRange().getValues().slice(1);
    const map = {};
    data
        .filter(r => {
            if (String(r[6]) !== chatId) return false;
            if (r[2] !== 'gasto') return false;
            // Formatea la fecha del objeto Date a "yyyy-MM" para comparar
            const fechaStr = Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM');
            return fechaStr === mes;
        })
        .forEach(r => {
            const c = r[4].toLowerCase();
            map[c] = (map[c] || 0) + parseFloat(r[5]);
        });
    return map;
}

