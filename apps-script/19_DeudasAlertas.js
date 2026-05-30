// ---- DEUDAS, ALERTAS E INSIGHTS ----------------------------

function cmdDeudas(chatId, text) {
  const clean = String(text || '').trim();
  const lower = clean.toLowerCase();

  if (lower === 'deudas' || lower === 'deuda') return mostrarDeudas(chatId);

  if (lower.indexOf('pagar deuda ') === 0) {
    return pagarDeuda(chatId, clean.replace(/^pagar deuda\s+/i, ''));
  }

  const match = clean.match(/^deuda\s+(.+?)\s+([\d]+(?:[.,]\d{1,2})?)(?:\s+(PEN|USD))?(?:\s+vence\s+(\d{4}-\d{2}-\d{2}))?(?:\s+(.+))?$/i);
  if (!match) {
    return sendMessage(chatId,
      'Formato:\n' +
      '`deuda laptop 2500 vence 2026-06-30`\n' +
      '`deuda viaje 800 USD vence 2026-08-15`\n' +
      '`pagar deuda laptop 300`\n' +
      '`deudas`', true);
  }

  const nombre = match[1].trim().toLowerCase();
  const total = parseFloat(String(match[2]).replace(',', '.'));
  const currency = normalizarMoneda_(match[3]) || 'PEN';
  const vencimiento = match[4] || '';
  const notas = match[5] || '';

  if (!nombre || isNaN(total) || total <= 0) {
    return sendMessage(chatId, 'Monto invalido. Ej: `deuda laptop 2500 vence 2026-06-30`', true);
  }

  const sheet = hojaDeudas_();
  const row = buscarFilaDeuda_(chatId, nombre);
  const deuda = {
    chatId: chatId,
    nombre: nombre,
    total: total,
    pagado: row ? row.values.pagado : 0,
    currency: currency,
    vencimiento: vencimiento,
    estado: row && row.values.pagado >= total ? 'pagada' : 'activa',
    notas: notas,
  };

  if (row) {
    sheet.getRange(row.rowNumber, 3, 1, 6).setValues([[
      deuda.total,
      deuda.pagado,
      deuda.vencimiento,
      deuda.estado,
      deuda.notas,
      deuda.currency,
    ]]);
  } else {
    sheet.appendRow([chatId, deuda.nombre, deuda.total, deuda.pagado, deuda.vencimiento, deuda.estado, deuda.notas, deuda.currency]);
  }

  guardarDeudaD1(deuda);

  return sendMessage(chatId,
    `*Deuda registrada*\n\n` +
    `${capitalizar(nombre)}\n` +
    `Total: ${formatoMoneda_(total, currency)}\n` +
    (vencimiento ? `Vence: ${vencimiento}\n` : '') +
    `\n_Paga con:_ \`pagar deuda ${nombre} 100${currency === 'USD' ? ' USD' : ''}\``, true);
}

function mostrarDeudas(chatId) {
  const deudas = leerDeudas_(chatId);
  const activas = deudas.filter(d => d.estado !== 'pagada' && d.pendiente > 0);

  if (!activas.length) {
    return sendMessage(chatId,
      'No tienes deudas activas.\n\nAgrega una:\n`deuda laptop 2500 vence 2026-06-30`', true);
  }

  const totalPen = activas.filter(item => item.currency !== 'USD').reduce((acc, item) => acc + item.pendiente, 0);
  const totalUsd = activas.filter(item => item.currency === 'USD').reduce((acc, item) => acc + item.pendiente, 0);
  const lineas = activas.map(item => {
    const pct = Math.round((item.pagado / item.total) * 100);
    return `- ${capitalizar(item.nombre)} - ${formatoMoneda_(item.pendiente, item.currency)} pendiente _(${pct}% pagado${item.vencimiento ? ', vence ' + item.vencimiento : ''})_`;
  }).join('\n');
  const resumen = [
    totalPen > 0 ? `S/ ${totalPen.toFixed(2)}` : '',
    totalUsd > 0 ? `US$ ${totalUsd.toFixed(2)}` : '',
  ].filter(Boolean).join(' + ') || 'S/ 0.00';

  return sendMessage(chatId,
    `*Deudas activas*\n\n${lineas}\n\n` +
    `-----------------\n` +
    `Total pendiente: *${resumen}*\n\n` +
    `_Registra pago con:_ \`pagar deuda nombre monto\``, true);
}

function pagarDeuda(chatId, payload) {
  const match = String(payload || '').trim().match(/^(.+?)\s+([\d]+(?:[.,]\d{1,2})?)(?:\s+(PEN|USD))?$/i);
  if (!match) {
    return sendMessage(chatId, 'Formato: `pagar deuda laptop 300` o `pagar deuda viaje 100 USD`', true);
  }

  const nombre = match[1].trim().toLowerCase();
  const monto = parseFloat(String(match[2]).replace(',', '.'));
  const paymentCurrency = normalizarMoneda_(match[3]) || '';
  if (!nombre || isNaN(monto) || monto <= 0) {
    return sendMessage(chatId, 'Monto invalido. Ej: `pagar deuda laptop 300`', true);
  }

  const row = buscarFilaDeuda_(chatId, nombre);
  if (!row) {
    return sendMessage(chatId, `No encontre la deuda *${nombre}*. Usa \`deudas\` para verlas.`, true);
  }

  const deuda = row.values;
  if (paymentCurrency && paymentCurrency !== deuda.currency) {
    return sendMessage(chatId, `Esa deuda esta en *${deuda.currency}*. Registra el pago en la misma moneda.`, true);
  }

  const pendienteAntes = Math.max(deuda.total - deuda.pagado, 0);
  const montoAplicado = Math.min(monto, pendienteAntes);
  if (montoAplicado <= 0) {
    return sendMessage(chatId, `La deuda *${deuda.nombre}* ya figura como pagada.`, true);
  }

  deuda.pagado = Math.min(deuda.total, deuda.pagado + montoAplicado);
  deuda.estado = deuda.pagado >= deuda.total ? 'pagada' : 'activa';

  const sheet = hojaDeudas_();
  sheet.getRange(row.rowNumber, 4, 1, 2).setValues([[deuda.pagado, deuda.vencimiento]]);
  sheet.getRange(row.rowNumber, 6).setValue(deuda.estado);

  const paymentDate = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
  registrarPagoDeudaComoTransaccion_(chatId, deuda, montoAplicado, paymentDate);
  if (!guardarPagoDeudaD1(deuda, montoAplicado, paymentDate, 'Telegram', false)) {
    guardarDeudaD1(deuda);
  }

  const pendiente = Math.max(deuda.total - deuda.pagado, 0);
  return sendMessage(chatId,
    `*Pago registrado*\n\n` +
    `${capitalizar(deuda.nombre)}\n` +
    `Pagado ahora: ${formatoMoneda_(montoAplicado, deuda.currency)}\n` +
    `Pendiente: *${formatoMoneda_(pendiente, deuda.currency)}*\n` +
    (deuda.estado === 'pagada' ? '\nDeuda completada.' : ''), true);
}

function registrarPagoDeudaComoTransaccion_(chatId, deuda, monto, fecha) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const txSheet = ss.getSheetByName('Transacciones') || crearHojaTransacciones();
  asegurarColumnasPagoTransacciones_(txSheet);

  const hora = Utilities.formatDate(new Date(), 'America/Lima', 'HH:mm');
  const desc = 'Pago deuda ' + capitalizar(deuda.nombre);
  const cat = normalizarCat('deudas', desc, chatId);
  const currency = normalizarMoneda_(deuda.currency || deuda.moneda) || 'PEN';

  txSheet.appendRow([fecha, hora, 'gasto', desc, cat, monto, chatId, 'debito', '', '', currency]);
  guardarTransaccionD1({
    chatId: chatId,
    fecha: fecha,
    hora: hora,
    tipo: 'gasto',
    desc: desc,
    cat: cat,
    monto: monto,
    currency: currency,
    paymentMethod: 'debito',
    source: 'telegram_debt_payment',
  });
}

function cmdAlertasInteligentes(chatId) {
  const alertas = calcularAlertasInteligentes_(chatId);
  if (!alertas.length) {
    return sendMessage(chatId, 'Sin alertas fuertes por ahora. Todo se ve bajo control.', true);
  }

  const lineas = alertas.map(a => `${a.icon} *${a.titulo}*\n${a.mensaje}`).join('\n\n');
  return sendMessage(chatId, `*Alertas inteligentes*\n\n${lineas}`, true);
}

function cmdInsightsIA(chatId) {
  const contexto = contextoInsightsIA_(chatId);
  sendMessage(
    chatId,
    `*Preparando insights IA...*\n\n` +
    `Estoy leyendo:\n` +
    `- ${contexto.movimientosMes} movimientos de este mes\n` +
    `- ${contexto.categoriasCount} categorias con gasto\n` +
    `- ${contexto.deudasActivas} deudas activas\n` +
    `- ${contexto.alertasCount} alertas inteligentes\n\n` +
    `_Dame unos segundos._`,
    true
  );

  const resumen = contexto.resumen;
  const prompt = [
    'Eres un asesor financiero personal para Mayeson en Peru.',
    'Da insights accionables, breves y concretos. No des teoria.',
    '',
    resumen,
    '',
    'Formato:',
    '*Insights inteligentes*',
    '',
    '1. [insight con numero real]',
    '2. [insight con numero real]',
    '3. [accion recomendada]',
    '',
    'Cierra con una prioridad para las proximas 48 horas.',
  ].join('\n');

  try {
    const props = PropertiesService.getScriptProperties();
    const apiKey = props.getProperty('claude_api_key');
    if (!apiKey) return sendMessage(chatId, 'Falta configurar `claude_api_key` para insights IA.', true);

    const claudeUrl = props.getProperty('claude_api_url') || 'https://api.synterolink.com/v1/messages';
    const claudeModel = props.getProperty('claude_model') || 'claude-haiku-4-5-20251001';
    let resp = fetchIAConReintentos_(claudeUrl, {
      method: 'post',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        model: claudeModel,
        max_tokens: 450,
        messages: [{ role: 'user', content: prompt }],
      }),
      muteHttpExceptions: true,
    }, 'insights /v1/messages');

    let raw = resp.getContentText();
    let responseCode = resp.getResponseCode();
    let chatCompletionsFallback = false;

    if (debeReintentarChatCompletions_(responseCode, raw, claudeUrl)) {
      Logger.log('Insights /v1/messages bloqueado; reintentando /v1/chat/completions.');
      resp = llamarIAChatCompletions_(apiKey, claudeUrl, claudeModel, 450, prompt, '', '');
      raw = resp.getContentText();
      responseCode = resp.getResponseCode();
      chatCompletionsFallback = responseCode < 300;
    }

    const result = parseJsonSeguro_(raw, null);
    const text = chatCompletionsFallback
      ? result && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content
      : result && result.content && result.content.find(b => b.type === 'text');
    if (responseCode >= 300 || !text) {
      Logger.log('Insights IA error: ' + raw);
      return sendMessage(chatId, mensajeErrorClaudeUsuario_(responseCode, raw, 'insights'), true);
    }

    return sendMessage(chatId, chatCompletionsFallback ? text : text.text, true);
  } catch (err) {
    Logger.log('Error cmdInsightsIA: ' + err);
    return sendMessage(chatId, 'Error generando insights IA.', true);
  }
}

function contextoInsightsIA_(chatId) {
  const d1 = leerDashboardD1_(chatId);
  if (d1 && d1.ok) {
    const deudas = (d1.deudas || []).filter(d => d.estado !== 'pagada' && Number(d.pendiente || 0) > 0);
    const alertas = d1.alertas || [];

    return {
      movimientosMes: d1.movimientos || 0,
      categoriasCount: (d1.categorias || []).length,
      deudasActivas: deudas.length,
      alertasCount: alertas.length,
      resumen: resumenFinancieroParaIA_(chatId),
    };
  }

  const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const txs = obtenerTransacciones(chatId).filter(r =>
    mesKey_(r[0]) === mes
  );
  const gastosCat = (obtenerGastosPorMesCat(chatId, mes)[mes]) || {};
  const deudas = leerDeudas_(chatId).filter(d => d.estado !== 'pagada' && d.pendiente > 0);
  const alertas = calcularAlertasInteligentes_(chatId);

  return {
    movimientosMes: txs.length,
    categoriasCount: Object.keys(gastosCat).length,
    deudasActivas: deudas.length,
    alertasCount: alertas.length,
    resumen: resumenFinancieroParaIA_(chatId),
  };
}

function calcularAlertasInteligentes_(chatId) {
  const d1 = leerDashboardD1_(chatId);
  if (d1 && d1.ok) {
    return (d1.alertas || []).map(a => ({
      icon: a.level === 'danger' ? '[!]' : a.level === 'warning' ? '[!]' : '[i]',
      titulo: a.title || 'Alerta',
      mensaje: a.message || '',
    }));
  }

  const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const hoy = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
  const presupuestos = leerPresupuestosReales_(chatId);
  const gastosCat = (obtenerGastosPorMesCat(chatId, mes)[mes]) || {};
  const fijos = leerFijos_(chatId);
  const deudas = leerDeudas_(chatId).filter(d => d.estado !== 'pagada' && d.pendiente > 0);
  const txsMes = obtenerTransacciones(chatId).filter(r =>
    mesKey_(r[0]) === mes
  );
  const ingresosMes = txsMes.filter(r => r[2] === 'ingreso').reduce((a, r) => a + (parseFloat(r[5]) || 0), 0);
  const gastosMes = txsMes.filter(r => r[2] === 'gasto').reduce((a, r) => a + (parseFloat(r[5]) || 0), 0);
  const alertas = [];

  presupuestos.forEach(p => {
    const gastado = gastosCat[p.cat] || 0;
    const pct = p.limite > 0 ? Math.round((gastado / p.limite) * 100) : 0;
    if (pct >= 100) alertas.push({ icon: '[!]', titulo: `Presupuesto superado: ${capitalizar(p.cat)}`, mensaje: `S/ ${gastado.toFixed(2)} de S/ ${p.limite.toFixed(2)} (${pct}%).` });
    else if (pct >= 80) alertas.push({ icon: '[!]', titulo: `Presupuesto cerca del limite: ${capitalizar(p.cat)}`, mensaje: `Ya usaste ${pct}% del limite.` });
  });

  fijos.filter(f => !fijoYaRegistradoEnMes_(chatId, f, mes) && !fijoEstaSaltado_(chatId, f, mes)).slice(0, 3)
    .forEach(f => alertas.push({ icon: '[F]', titulo: `Fijo pendiente: ${capitalizar(f.nombre)}`, mensaje: `Falta registrar o saltar S/ ${f.monto.toFixed(2)}.` }));

  deudas.forEach(d => {
    if (!d.vencimiento) return;
    const dias = diasEntreFechas_(hoy, d.vencimiento);
    if (dias < 0) alertas.push({ icon: '[!]', titulo: `Deuda vencida: ${capitalizar(d.nombre)}`, mensaje: `Pendiente ${formatoMoneda_(d.pendiente, d.currency)} desde ${d.vencimiento}.` });
    else if (dias <= 7) alertas.push({ icon: '[!]', titulo: `Deuda por vencer: ${capitalizar(d.nombre)}`, mensaje: `Vence en ${dias} dia${dias === 1 ? '' : 's'} y queda ${formatoMoneda_(d.pendiente, d.currency)}.` });
  });

  if (ingresosMes > 0 && gastosMes > ingresosMes) {
    alertas.push({ icon: '[!]', titulo: 'Gastos sobre ingresos', mensaje: `Este mes gastaste S/ ${gastosMes.toFixed(2)} vs S/ ${ingresosMes.toFixed(2)} de ingresos.` });
  }

  return alertas.slice(0, 8);
}

function resumenFinancieroParaIA_(chatId) {
  const d1 = leerDashboardD1_(chatId);
  if (d1 && d1.ok) {
    const deudas = (d1.deudas || []).filter(d => d.estado !== 'pagada' && Number(d.pendiente || 0) > 0);
    const deudaPen = deudas.filter(d => d.currency !== 'USD').reduce((a, d) => a + Number(d.pendiente || 0), 0);
    const deudaUsd = deudas.filter(d => d.currency === 'USD').reduce((a, d) => a + Number(d.pendiente || 0), 0);
    const topCats = (d1.categorias || [])
      .slice(0, 5)
      .map(item => `- ${item.cat}: S/ ${Number(item.monto || 0).toFixed(2)}`)
      .join('\n');

    return [
      `Mes: ${d1.mesKey || ''}`,
      `Ingresos: S/ ${Number(d1.ingresosMes || 0).toFixed(2)}`,
      `Gastos: S/ ${Number(d1.gastosMes || 0).toFixed(2)}`,
      `Balance: S/ ${Number(d1.balanceMes || 0).toFixed(2)}`,
      `Deuda pendiente PEN: S/ ${deudaPen.toFixed(2)}`,
      `Deuda pendiente USD: US$ ${deudaUsd.toFixed(2)}`,
      'Top categorias:',
      topCats || '- sin gastos',
      'Alertas:',
      (d1.alertas || []).map(a => `- ${a.title}: ${a.message}`).join('\n') || '- sin alertas',
      'Fuente: D1',
    ].join('\n');
  }

  const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const txs = obtenerTransacciones(chatId).filter(r =>
    mesKey_(r[0]) === mes
  );
  const ingresos = txs.filter(r => r[2] === 'ingreso').reduce((a, r) => a + (parseFloat(r[5]) || 0), 0);
  const gastos = txs.filter(r => r[2] === 'gasto').reduce((a, r) => a + (parseFloat(r[5]) || 0), 0);
  const gastosCat = (obtenerGastosPorMesCat(chatId, mes)[mes]) || {};
  const deudas = leerDeudas_(chatId).filter(d => d.estado !== 'pagada' && d.pendiente > 0);
  const deudaPen = deudas.filter(d => d.currency !== 'USD').reduce((a, d) => a + d.pendiente, 0);
  const deudaUsd = deudas.filter(d => d.currency === 'USD').reduce((a, d) => a + d.pendiente, 0);
  const topCats = Object.entries(gastosCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, monto]) => `- ${cat}: S/ ${monto.toFixed(2)}`)
    .join('\n');

  return [
    `Mes: ${mes}`,
    `Ingresos: S/ ${ingresos.toFixed(2)}`,
    `Gastos: S/ ${gastos.toFixed(2)}`,
    `Balance: S/ ${(ingresos - gastos).toFixed(2)}`,
    `Deuda pendiente PEN: S/ ${deudaPen.toFixed(2)}`,
    `Deuda pendiente USD: US$ ${deudaUsd.toFixed(2)}`,
    'Top categorias:',
    topCats || '- sin gastos',
    'Alertas:',
    calcularAlertasInteligentes_(chatId).map(a => `- ${a.titulo}: ${a.mensaje}`).join('\n') || '- sin alertas',
  ].join('\n');
}

function hojaDeudas_() {
  const sheet = getOrCreateSheet('Deudas', ['ChatID', 'Nombre', 'Total', 'Pagado', 'Vencimiento', 'Estado', 'Notas', 'Currency']);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  if (headers.indexOf('Currency') < 0) {
    sheet.getRange(1, headers.length + 1).setValue('Currency');
  }
  return sheet;
}

function leerDeudas_(chatId) {
  const d1 = leerDashboardD1_(chatId);
  if (d1 && d1.ok) {
    return (d1.deudas || []).map(d => ({
      chatId: String(chatId),
      nombre: String(d.nombre || '').trim(),
      total: Number(d.total || 0),
      pagado: Number(d.pagado || 0),
      pendiente: Number(d.pendiente || Math.max(Number(d.total || 0) - Number(d.pagado || 0), 0)),
      vencimiento: d.vencimiento || '',
      estado: String(d.estado || 'activa').toLowerCase(),
      notas: String(d.notas || ''),
      currency: normalizarMoneda_(d.currency) || 'PEN',
    })).filter(d => d.nombre && d.total > 0);
  }

  const sheet = hojaDeudas_();
  return sheet.getDataRange().getValues().slice(1)
    .filter(r => String(r[0]) === String(chatId))
    .map(r => {
      const total = parseFloat(r[2]) || 0;
      const pagado = parseFloat(r[3]) || 0;
      return {
        chatId: String(r[0]),
        nombre: String(r[1] || '').trim(),
        total: total,
        pagado: pagado,
        pendiente: Math.max(total - pagado, 0),
        vencimiento: formatearFechaDeuda_(r[4]),
        estado: String(r[5] || 'activa').toLowerCase(),
        notas: String(r[6] || ''),
        currency: normalizarMoneda_(r[7]) || 'PEN',
      };
    })
    .filter(d => d.nombre && d.total > 0);
}

function buscarFilaDeuda_(chatId, nombre) {
  const sheet = hojaDeudas_();
  const data = sheet.getDataRange().getValues();
  const key = String(nombre || '').trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(chatId) && String(data[i][1] || '').toLowerCase() === key) {
      const total = parseFloat(data[i][2]) || 0;
      const pagado = parseFloat(data[i][3]) || 0;
      return {
        rowNumber: i + 1,
        values: {
          chatId: String(data[i][0]),
          nombre: String(data[i][1]),
          total: total,
          pagado: pagado,
          vencimiento: formatearFechaDeuda_(data[i][4]),
          estado: String(data[i][5] || 'activa').toLowerCase(),
          notas: String(data[i][6] || ''),
          currency: normalizarMoneda_(data[i][7]) || 'PEN',
        },
      };
    }
  }
  return null;
}

function formatearFechaDeuda_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, 'America/Lima', 'yyyy-MM-dd');
  }
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function diasEntreFechas_(from, to) {
  const a = new Date(from + 'T00:00:00Z').getTime();
  const b = new Date(to + 'T00:00:00Z').getTime();
  if (isNaN(a) || isNaN(b)) return 9999;
  return Math.round((b - a) / 86400000);
}
