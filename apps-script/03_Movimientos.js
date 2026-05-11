// ---- REGISTRAR MOVIMIENTO ----------------------------------

function registrarMovimiento(chatId, match, originalText) {
    const tipo = match[1];
    const monto = parseFloat(match[2].replace(',', '.'));
    const cat = normalizarCat(match[3], match[4]);
    const desc = match[4]
        ? capitalizar(match[4])
        : capitalizar(cat);

    if (isNaN(monto) || monto <= 0) {
        return sendMessage(chatId, '❌ El monto debe ser un número positivo. Ej: *gasto 45.50 comida almuerzo*', true);
    }

    const fecha = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
    const hora = Utilities.formatDate(new Date(), 'America/Lima', 'HH:mm');

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones')
        || crearHojaTransacciones();

    sheet.appendRow([fecha, hora, tipo, desc, cat.toLowerCase(), monto, chatId]);
    const d1Ok = guardarTransaccionD1({
        chatId: chatId,
        fecha: fecha,
        hora: hora,
        tipo: tipo,
        desc: desc,
        cat: cat,
        monto: monto,
        source: 'telegram_text',
    });
    

    const emoji = tipo === 'gasto' ? '📤' : '📥';
    const color = tipo === 'gasto' ? '🔴' : '🟢';

    sendMessage(chatId,
        `${emoji} *¡Registrado!*

` +
        `${color} ${desc}
` +
        `💵 S/ ${monto.toFixed(2)}
` +
        `🏷️ ${capitalizar(cat)}
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

// ---- PRESUPUESTO MENSUAL -----------------------------------
// Guarda los presupuestos en la hoja "Presupuestos"
// Columnas: ChatID | Categoría | Limite

function cmdPresupuesto(chatId, text) {
    const parts = text.split(' ');

    if (parts.length === 1) return mostrarPresupuestos(chatId);

    const cat = normalizarCat(parts[1]);
    const limit = parseFloat(parts[2]);

    if (!cat || isNaN(limit) || limit <= 0) {
        return sendMessage(chatId,
            '❌ Formato: *presupuesto [categoría] [monto]* Ej: presupuesto comida 500', true);
    }

    const sheet = getOrCreateSheet('Presupuestos', ['ChatID', 'Categoría', 'Límite']);
    const data = sheet.getDataRange().getValues();

    // Actualiza si ya existe, si no agrega fila nueva
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === chatId && normalizarCat(data[i][1]) === cat) {
            sheet.getRange(i + 1, 3).setValue(limit);
            return sendMessage(chatId,
                `✅ Presupuesto actualizado

🏷️ ${capitalizar(cat)}
💰 S/ ${limit.toFixed(2)} / mes`, true);
        }
    }
    sheet.appendRow([chatId, cat, limit]);
    sendMessage(chatId,
        `✅ Presupuesto guardado

🏷️ ${capitalizar(cat)}
💰 S/ ${limit.toFixed(2)} / mes

_Escribe *presupuesto* para ver todos._`, true);
}

function mostrarPresupuestos(chatId) {
    const sheet = getOrCreateSheet('Presupuestos', ['ChatID', 'Categoría', 'Límite']);
    const data = sheet.getDataRange().getValues().slice(1)
        .filter(r => String(r[0]) === chatId);

    if (!data.length) {
        return sendMessage(chatId,
            '📭 No tienes presupuestos. Crea uno: `presupuesto comida 500`', true);
    }

    const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
    const gastosCat = (obtenerGastosPorMesCat(chatId, mes)[mes]) || {};
    let msg = `📊 *Presupuestos — ${mes}*

`;

    data.forEach(r => {
        const cat = r[1];
        const limite = parseFloat(r[2]);
        const gasto = gastosCat[cat.toLowerCase()] || 0;
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
  const sheet = getOrCreateSheet('Presupuestos', ['ChatID','Categoría','Límite']);
  const fila  = sheet.getDataRange().getValues().slice(1)
    .find(r => String(r[0]) === chatId && r[1].toLowerCase() === cat.toLowerCase());

  if (!fila) return;

  const limite    = parseFloat(fila[2]);
  const mes       = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const porCat    = (obtenerGastosPorMesCat(chatId, mes)[mes]) || {}; // ← fix
  const gasto     = porCat[cat.toLowerCase()] || 0;
  const pct       = Math.round((gasto / limite) * 100);

  if (pct >= 100) {
    sendMessage(chatId,
      `🔴 *¡Presupuesto superado!*\n` +
      `${capitalizar(cat)}: S/ ${gasto.toFixed(2)} / S/ ${limite.toFixed(2)}`, true);
  } else if (pct >= 80) {
    sendMessage(chatId,
      `🟡 *Alerta:* llevas el ${pct}% de ${capitalizar(cat)}\n` +
      `S/ ${gasto.toFixed(2)} de S/ ${limite.toFixed(2)}`, true);
  }
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

