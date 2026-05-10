// ---- REGISTRAR MOVIMIENTO ----------------------------------

function registrarMovimiento(chatId, match, originalText) {
    const tipo = match[1];
    const monto = parseFloat(match[2].replace(',', '.'));
    const cat = normalizarCat(match[3], match[4]);
    const desc = match[4]
        ? capitalizar(match[4])
        : capitalizar(cat);

    if (isNaN(monto) || monto <= 0) {
        return sendMessage(chatId, 'âŒ El monto debe ser un nÃºmero positivo. Ej: *gasto 45.50 comida almuerzo*', true);
    }

    const fecha = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
    const hora = Utilities.formatDate(new Date(), 'America/Lima', 'HH:mm');

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones')
        || crearHojaTransacciones();

    sheet.appendRow([fecha, hora, tipo, desc, cat.toLowerCase(), monto, chatId]);
    guardarTransaccionD1({
        chatId: chatId,
        fecha: fecha,
        hora: hora,
        tipo: tipo,
        desc: desc,
        cat: cat,
        monto: monto,
        source: 'telegram_text',
    });
    

    const emoji = tipo === 'gasto' ? 'ðŸ“¤' : 'ðŸ“¥';
    const color = tipo === 'gasto' ? 'ðŸ”´' : 'ðŸŸ¢';

    sendMessage(chatId,
        `${emoji} *Â¡Registrado!*

` +
        `${color} ${desc}
` +
        `ðŸ’µ S/ ${monto.toFixed(2)}
` +
        `ðŸ·ï¸ ${capitalizar(cat)}
` +
        `ðŸ“… ${fecha}

` +
        `_Escribe *balance* para ver tu saldo._`,
        true
    );
    // Alerta si supera el presupuesto de esta categorÃ­a
    if (tipo === 'gasto') verificarPresupuesto(chatId, cat);
}

// ---- PRESUPUESTO MENSUAL -----------------------------------
// Guarda los presupuestos en la hoja "Presupuestos"
// Columnas: ChatID | CategorÃ­a | Limite

function cmdPresupuesto(chatId, text) {
    const parts = text.split(' ');

    if (parts.length === 1) return mostrarPresupuestos(chatId);

    const cat = normalizarCat(parts[1]);
    const limit = parseFloat(parts[2]);

    if (!cat || isNaN(limit) || limit <= 0) {
        return sendMessage(chatId,
            'âŒ Formato: *presupuesto [categorÃ­a] [monto]* Ej: presupuesto comida 500', true);
    }

    const sheet = getOrCreateSheet('Presupuestos', ['ChatID', 'CategorÃ­a', 'LÃ­mite']);
    const data = sheet.getDataRange().getValues();

    // Actualiza si ya existe, si no agrega fila nueva
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === chatId && normalizarCat(data[i][1]) === cat) {
            sheet.getRange(i + 1, 3).setValue(limit);
            return sendMessage(chatId,
                `âœ… Presupuesto actualizado

ðŸ·ï¸ ${capitalizar(cat)}
ðŸ’° S/ ${limit.toFixed(2)} / mes`, true);
        }
    }
    sheet.appendRow([chatId, cat, limit]);
    sendMessage(chatId,
        `âœ… Presupuesto guardado

ðŸ·ï¸ ${capitalizar(cat)}
ðŸ’° S/ ${limit.toFixed(2)} / mes

_Escribe *presupuesto* para ver todos._`, true);
}

function mostrarPresupuestos(chatId) {
    const sheet = getOrCreateSheet('Presupuestos', ['ChatID', 'CategorÃ­a', 'LÃ­mite']);
    const data = sheet.getDataRange().getValues().slice(1)
        .filter(r => String(r[0]) === chatId);

    if (!data.length) {
        return sendMessage(chatId,
            'ðŸ“­ No tienes presupuestos. Crea uno: `presupuesto comida 500`', true);
    }

    const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
    const gastosCat = (obtenerGastosPorMesCat(chatId, mes)[mes]) || {};
    let msg = `ðŸ“Š *Presupuestos â€” ${mes}*

`;

    data.forEach(r => {
        const cat = r[1];
        const limite = parseFloat(r[2]);
        const gasto = gastosCat[cat.toLowerCase()] || 0;
        const pct = Math.min(Math.round((gasto / limite) * 100), 100);
        const estado = pct >= 100 ? 'ðŸ”´' : pct >= 80 ? 'ðŸŸ¡' : 'ðŸŸ¢';
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
  const sheet = getOrCreateSheet('Presupuestos', ['ChatID','CategorÃ­a','LÃ­mite']);
  const fila  = sheet.getDataRange().getValues().slice(1)
    .find(r => String(r[0]) === chatId && r[1].toLowerCase() === cat.toLowerCase());

  if (!fila) return;

  const limite    = parseFloat(fila[2]);
  const mes       = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const porCat    = (obtenerGastosPorMesCat(chatId, mes)[mes]) || {}; // â† fix
  const gasto     = porCat[cat.toLowerCase()] || 0;
  const pct       = Math.round((gasto / limite) * 100);

  if (pct >= 100) {
    sendMessage(chatId,
      `ðŸ”´ *Â¡Presupuesto superado!*\n` +
      `${capitalizar(cat)}: S/ ${gasto.toFixed(2)} / S/ ${limite.toFixed(2)}`, true);
  } else if (pct >= 80) {
    sendMessage(chatId,
      `ðŸŸ¡ *Alerta:* llevas el ${pct}% de ${capitalizar(cat)}\n` +
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
            'âŒ Formato:\n*meta [nombre] [objetivo]*\nEj: meta viaje europa 3000',
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
            `âš ï¸ Ya tienes una meta llamada *${capitalizar(nombre)}*.\nUsa *ahorrar ${nombre} [monto]* para sumar.`,
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
        `ðŸŽ¯ *Meta creada!* ðŸ“Œ ${capitalizar(nombre)}
         ðŸ’° Objetivo: S/ ${objetivo.toFixed(2)}
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
            'âŒ Formato:\n*ahorrar [meta] [monto]*\nEj: ahorrar viaje 200', true);
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
                (completada ? `ðŸ† *Â¡Meta alcanzada!*\n\n` : `ðŸ’ª *Ahorro registrado!*\n\n`) +
                `ðŸ“Œ ${capitalizar(nombre)}\n` +
                `${buildBar(pct)} ${pct}%\n\n` +
                `ðŸ’° S/ ${nuevo.toFixed(2)} de S/ ${objetivo.toFixed(2)}\n` +
                (completada
                    ? `\nðŸŽ‰ Â¡Lo lograste!`
                    : `\nâ³ Faltan S/ ${(objetivo - nuevo).toFixed(2)}`),
                true
            );
        }
    }

    sendMessage(chatId,
        `âŒ No encontrÃ© la meta *${capitalizar(nombre)}*.\nEscribe *metas* para ver tus metas.`, true);
}

function mostrarMetas(chatId) {
  const sheet = getOrCreateSheet('Metas', ['ChatID','Nombre','Objetivo','Ahorrado','Creada']);
  const data  = sheet.getDataRange().getValues().slice(1)
    .filter(r => String(r[0]) === chatId);

  if (!data.length) {
    return sendMessage(chatId,
      'ðŸ“­ No tienes metas de ahorro.\n\nCrea una:\n`meta viaje 3000`', true);
  }

  let msg = `ðŸŽ¯ *Tus metas de ahorro*\n\n`;

  data.forEach(r => {
    const ahorrado = parseFloat(r[3]);
    const objetivo = parseFloat(r[2]);
    const pct      = Math.min(Math.round((ahorrado / objetivo) * 100), 100);
    const faltan   = objetivo - ahorrado;
    const emoji    = pct >= 100 ? 'ðŸ†' : pct >= 50 ? 'ðŸ’ª' : 'ðŸŽ¯';

    msg += `- ${emoji} *${capitalizar(r[1])}*\n`;
    msg += `${buildBar(pct)} ${pct}%\n`;
    msg += `S/ ${ahorrado.toFixed(2)} / S/ ${objetivo.toFixed(2)}\n`;
    msg += pct >= 100
      ? `Â¡Meta completada! ðŸŽ‰\n`
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

