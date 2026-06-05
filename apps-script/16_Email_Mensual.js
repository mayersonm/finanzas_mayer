// ---- RESUMEN MENSUAL POR CORREO ----------------------------

function enviarResumenMensualEmailPeriodo_(periodoDate, modo) {
  const props = PropertiesService.getScriptProperties();
  const emailTo = getEmailTo_('monthly');
  const chatId = props.getProperty('dashboard_chat_id') || '1538086276';

  const resumen = construirResumenMensualEmail_(chatId, periodoDate, modo);

  MailApp.sendEmail({
    to: emailTo,
    subject: resumen.subject,
    body: resumen.textBody,
    htmlBody: resumen.htmlBody,
    attachments: [resumen.excelBlob],
    name: 'Finanzas Mayeson',
  });

  Logger.log('Resumen mensual enviado a ' + emailTo + ' (' + resumen.periodoKey + ')');
  return 'Resumen mensual enviado: ' + resumen.periodoKey;
}

function construirResumenMensualEmail_(chatId, periodoDate, modo) {
  const periodo = normalizarPeriodoPagoEmail_(periodoDate);
  const anterior = periodoPagoRelativoEmail_(periodo, -1);
  const periodoKey = periodo.key;
  const anteriorKey = anterior.key;
  const nombrePeriodo = periodo.label;
  const nombreAnterior = anterior.label;

  const txs = obtenerTransaccionesEmail_(chatId);
  const txsPeriodo = filtrarTransaccionesPeriodoEmail_(txs, periodo);
  const txsAnterior = filtrarTransaccionesPeriodoEmail_(txs, anterior);
  const totalesPeriodo = calcularTotalesEmail_(txsPeriodo);
  const totalesAnterior = calcularTotalesEmail_(txsAnterior);
  const categoriasPeriodo = agruparGastosPorCategoriaEmail_(txsPeriodo);
  const categoriasAnterior = agruparGastosPorCategoriaEmail_(txsAnterior);
  const comparativoCategorias = compararCategoriasMensualEmail_(categoriasPeriodo, categoriasAnterior);
  const presupuestos = obtenerPresupuestosEmail_(chatId, periodoKey, txsPeriodo);
  const metas = obtenerMetasEmail_(chatId);

  const data = {
    modo: modo || 'cierre',
    chatId: String(chatId),
    periodo: periodo,
    periodoKey: periodoKey,
    anteriorKey: anteriorKey,
    nombrePeriodo: nombrePeriodo,
    nombreAnterior: nombreAnterior,
    txsPeriodo: txsPeriodo,
    txsAnterior: txsAnterior,
    totalesPeriodo: totalesPeriodo,
    totalesAnterior: totalesAnterior,
    categoriasPeriodo: categoriasPeriodo,
    categoriasAnterior: categoriasAnterior,
    comparativoCategorias: comparativoCategorias,
    presupuestos: presupuestos,
    metas: metas,
    generadoEn: Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd HH:mm:ss'),
  };

  data.alertaAnualBase = construirAlertaAnualBaseMensualEmail_(data);
  data.sugerenciaIA = generarSugerenciaMensualIA_(data);

  if (modo !== 'prueba') {
    guardarCierreMensualEmail_(chatId, data);
  }

  const subjectPrefix = modo === 'prueba' ? '[Prueba] ' : '';
  const subject = subjectPrefix + 'Cierre financiero mensual - ' + nombrePeriodo;
  const textBody = construirTextoMensualEmail_(data);
  const htmlBody = construirHtmlMensualEmail_(data);
  const excelBlob = construirExcelMensualEmail_(data);

  return {
    periodoKey: periodoKey,
    subject: subject,
    textBody: textBody,
    htmlBody: htmlBody,
    excelBlob: excelBlob,
  };
}

function construirTextoMensualEmail_(data) {
  const balance = data.totalesPeriodo.ingresos - data.totalesPeriodo.gastos;
  const balanceAnterior = data.totalesAnterior.ingresos - data.totalesAnterior.gastos;
  const ahorroPct = data.totalesPeriodo.ingresos > 0 ? balance / data.totalesPeriodo.ingresos : 0;
  const comparativo = [
    'Ingresos: ' + fmtEmail_(data.totalesPeriodo.ingresos) + ' (' + fmtDeltaMontoEmail_(data.totalesPeriodo.ingresos, data.totalesAnterior.ingresos) + ')',
    'Gastos: ' + fmtEmail_(data.totalesPeriodo.gastos) + ' (' + fmtDeltaMontoEmail_(data.totalesPeriodo.gastos, data.totalesAnterior.gastos) + ')',
    'Balance: ' + fmtSignedEmail_(balance) + ' (' + fmtDeltaMontoEmail_(balance, balanceAnterior) + ')',
    'Ahorro estimado: ' + fmtPctEmail_(ahorroPct),
    'Movimientos: ' + data.txsPeriodo.length + ' (' + fmtDeltaNumeroEmail_(data.txsPeriodo.length, data.txsAnterior.length) + ')',
  ].join('\n');

  const categorias = data.comparativoCategorias.length
    ? data.comparativoCategorias.slice(0, 8).map(function (c) {
        return '- ' + capitalizar(c.cat) + ': ' + fmtEmail_(c.actual) + ' vs ' + fmtEmail_(c.anterior) + ' (' + fmtDeltaMontoSimpleEmail_(c.delta) + ')';
      }).join('\n')
    : '- Sin gastos por categoria en el periodo';

  const presupuestos = data.presupuestos.length
    ? data.presupuestos.map(function (p) {
        return '- ' + capitalizar(p.cat) + ': ' + fmtEmail_(p.gasto) + ' de ' + fmtEmail_(p.limite);
      }).join('\n')
    : '- Sin presupuestos configurados';

  return [
    'Cierre financiero mensual - ' + data.nombrePeriodo,
    'Periodo actual: ' + data.nombrePeriodo,
    'Periodo comparado: ' + data.nombreAnterior,
    '',
    comparativo,
    '',
    'Categorias principales',
    categorias,
    '',
    'Presupuestos',
    presupuestos,
    '',
    'Sugerencia financiera IA',
    data.sugerenciaIA,
    '',
    'Senal para alerta anual',
    data.alertaAnualBase.nivel + ': ' + data.alertaAnualBase.texto,
    '',
    'Nota: Esta sugerencia es educativa y de organizacion personal; no reemplaza asesoria financiera profesional.',
  ].join('\n');
}

function construirHtmlMensualEmail_(data) {
  const balance = data.totalesPeriodo.ingresos - data.totalesPeriodo.gastos;
  const balanceAnterior = data.totalesAnterior.ingresos - data.totalesAnterior.gastos;
  const ahorroPct = data.totalesPeriodo.ingresos > 0 ? balance / data.totalesPeriodo.ingresos : 0;
  const colorBalance = balance >= 0 ? '#16a34a' : '#dc2626';

  const comparativoRows = [
    filaComparativoMensualEmail_('Ingresos', data.totalesPeriodo.ingresos, data.totalesAnterior.ingresos, true),
    filaComparativoMensualEmail_('Gastos', data.totalesPeriodo.gastos, data.totalesAnterior.gastos, true),
    filaComparativoMensualEmail_('Balance', balance, balanceAnterior, true),
    filaComparativoMensualEmail_('Movimientos', data.txsPeriodo.length, data.txsAnterior.length, false),
  ].join('');

  const categoriasRows = data.comparativoCategorias.length
    ? data.comparativoCategorias.slice(0, 10).map(function (c) {
        const color = c.delta > 0 ? '#dc2626' : c.delta < 0 ? '#16a34a' : '#6b7280';
        return [
          '<tr>',
          '<td>' + escEmail_(capitalizar(c.cat)) + '</td>',
          '<td align="right"><strong>' + fmtEmail_(c.actual) + '</strong></td>',
          '<td align="right">' + fmtEmail_(c.anterior) + '</td>',
          '<td align="right" style="color:' + color + '"><strong>' + fmtDeltaMontoSimpleEmail_(c.delta) + '</strong></td>',
          '<td align="right">' + fmtPctEmail_(c.participacion) + '</td>',
          '</tr>',
        ].join('');
      }).join('')
    : '<tr><td colspan="5" style="color:#6b7280">Sin gastos por categoria en el periodo.</td></tr>';

  const presupuestosHtml = data.presupuestos.length
    ? data.presupuestos.map(function (p) {
        const pct = p.limite > 0 ? Math.min(Math.round((p.gasto / p.limite) * 100), 100) : 0;
        const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : '#16a34a';
        return bloqueAvanceEmail_(
          capitalizar(p.cat),
          fmtEmail_(p.gasto) + ' / ' + fmtEmail_(p.limite),
          pct,
          color,
          pct + '% usado'
        );
      }).join('')
    : '<p style="color:#6b7280;margin:0">Sin presupuestos configurados.</p>';

  const iaHtml = escEmail_(data.sugerenciaIA).replace(/\n/g, '<br>');
  const mesesComparadosHtml = [
    '<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse">',
    '<tr><td style="color:#6b7280">Periodo actual</td><td align="right"><strong>' + escEmail_(data.nombrePeriodo) + '</strong></td></tr>',
    '<tr><td style="color:#6b7280">Periodo comparado</td><td align="right"><strong>' + escEmail_(data.nombreAnterior) + '</strong></td></tr>',
    '</table>',
  ].join('');

  return [
    '<div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827">',
    '<div style="max-width:760px;margin:0 auto;padding:24px">',
    '<div style="background:#111827;color:#f9fafb;border-radius:14px;padding:22px;margin-bottom:16px">',
    '<div style="font-size:12px;text-transform:uppercase;color:#9ca3af">Cierre financiero mensual</div>',
    '<h1 style="margin:6px 0 0;font-size:24px">' + escEmail_(data.nombrePeriodo) + '</h1>',
    '<div style="font-size:13px;color:#d1d5db;margin-top:8px">Comparativa: ' + escEmail_(data.nombrePeriodo) + ' vs ' + escEmail_(data.nombreAnterior) + '</div>',
    '</div>',
    cardsEmail_([
      ['Ingresos', fmtEmail_(data.totalesPeriodo.ingresos), '#16a34a'],
      ['Gastos', fmtEmail_(data.totalesPeriodo.gastos), '#dc2626'],
      ['Balance', fmtSignedEmail_(balance), colorBalance],
      ['Ahorro estimado', fmtPctEmail_(ahorroPct), ahorroPct >= 0 ? '#2563eb' : '#dc2626'],
    ]),
    seccionEmail_('Meses comparados', mesesComparadosHtml),
    seccionEmail_('Comparativo mensual', '<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse"><tr style="background:#f9fafb"><th align="left">Indicador</th><th align="right">' + escEmail_(data.nombrePeriodo) + '</th><th align="right">' + escEmail_(data.nombreAnterior) + '</th><th align="right">Cambio</th></tr>' + comparativoRows + '</table>'),
    seccionEmail_('Gastos por categoria', '<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse"><tr style="background:#f9fafb"><th align="left">Categoria</th><th align="right">' + escEmail_(data.nombrePeriodo) + '</th><th align="right">' + escEmail_(data.nombreAnterior) + '</th><th align="right">Cambio</th><th align="right">Participacion</th></tr>' + categoriasRows + '</table>'),
    seccionEmail_('Presupuestos', presupuestosHtml),
    seccionEmail_('Sugerencia financiera IA', '<div style="line-height:1.55;font-size:14px">' + iaHtml + '</div><p style="font-size:12px;color:#6b7280;margin:14px 0 0">Contenido educativo para organizacion personal. No reemplaza asesoria financiera profesional.</p>'),
    seccionEmail_('Senal para alerta anual', '<p style="margin:0;line-height:1.55"><strong>' + escEmail_(data.alertaAnualBase.nivel) + ':</strong> ' + escEmail_(data.alertaAnualBase.texto) + '</p>'),
    '<p style="font-size:12px;color:#6b7280;text-align:center;margin-top:18px">Archivo Excel adjunto generado el ' + escEmail_(data.generadoEn) + '.</p>',
    '</div>',
    '</div>',
  ].join('');
}

function filaComparativoMensualEmail_(label, actual, anterior, money) {
  const delta = Number(actual || 0) - Number(anterior || 0);
  const color = delta > 0 ? '#dc2626' : delta < 0 ? '#16a34a' : '#6b7280';

  return [
    '<tr>',
    '<td>' + escEmail_(label) + '</td>',
    '<td align="right"><strong>' + (money ? fmtSignedEmail_(actual) : String(actual || 0)) + '</strong></td>',
    '<td align="right">' + (money ? fmtSignedEmail_(anterior) : String(anterior || 0)) + '</td>',
    '<td align="right" style="color:' + color + '"><strong>' + (money ? fmtDeltaMontoSimpleEmail_(delta) : fmtDeltaNumeroSimpleEmail_(delta)) + '</strong></td>',
    '</tr>',
  ].join('');
}

function construirExcelMensualEmail_(data) {
  const fileName = 'finanzas_resumen_mensual_' + data.periodoKey;
  const ss = SpreadsheetApp.create(fileName);

  try {
    const resumenSheet = ss.getSheets()[0];
    resumenSheet.setName('Resumen');
    llenarHojaResumenMensualEmail_(resumenSheet, data);

    const compSheet = ss.insertSheet('Comparativo');
    llenarHojaComparativoMensualEmail_(compSheet, data);

    const txSheet = ss.insertSheet('Transacciones');
    llenarHojaTransaccionesEmail_(txSheet, data.txsPeriodo);

    const catSheet = ss.insertSheet('Categorias');
    llenarHojaCategoriasMensualEmail_(catSheet, data);

    const presSheet = ss.insertSheet('Presupuestos');
    llenarHojaPresupuestosEmail_(presSheet, data.presupuestos);

    const metasSheet = ss.insertSheet('Metas');
    llenarHojaMetasEmail_(metasSheet, data.metas);

    const iaSheet = ss.insertSheet('Sugerencia IA');
    llenarHojaSugerenciaIAMensualEmail_(iaSheet, data);

    const anualSheet = ss.insertSheet('Base anual');
    llenarHojaBaseAnualMensualEmail_(anualSheet, data);

    SpreadsheetApp.flush();

    const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
    const response = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });

    return response.getBlob().setName(fileName + '.xlsx');
  } finally {
    DriveApp.getFileById(ss.getId()).setTrashed(true);
  }
}

function llenarHojaResumenMensualEmail_(sheet, data) {
  const balance = data.totalesPeriodo.ingresos - data.totalesPeriodo.gastos;
  const ahorroPct = data.totalesPeriodo.ingresos > 0 ? balance / data.totalesPeriodo.ingresos : 0;

  sheet.getRange('A1').setValue('Resumen financiero mensual');
  sheet.getRange('A2').setValue(data.nombrePeriodo + ' vs ' + data.nombreAnterior);

  sheet.getRange('A4:B10').setValues([
    ['Indicador', 'Valor'],
    ['Ingresos', data.totalesPeriodo.ingresos],
    ['Gastos', data.totalesPeriodo.gastos],
    ['Balance', balance],
    ['Ahorro estimado', ahorroPct],
    ['Movimientos', data.txsPeriodo.length],
    ['Generado', data.generadoEn],
  ]);

  sheet.getRange('D4:E8').setValues([
    ['Indicador', 'Mes anterior'],
    ['Ingresos', data.totalesAnterior.ingresos],
    ['Gastos', data.totalesAnterior.gastos],
    ['Balance', data.totalesAnterior.ingresos - data.totalesAnterior.gastos],
    ['Movimientos', data.txsAnterior.length],
  ]);

  aplicarTituloEmail_(sheet.getRange('A1:E1'));
  aplicarSubtituloEmail_(sheet.getRange('A4:B4'));
  aplicarSubtituloEmail_(sheet.getRange('D4:E4'));
  sheet.getRange('B5:B7').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('B8').setNumberFormat('0.00%');
  sheet.getRange('E5:E7').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('A:E').setVerticalAlignment('middle');
  sheet.autoResizeColumns(1, 5);
}

function llenarHojaComparativoMensualEmail_(sheet, data) {
  const balance = data.totalesPeriodo.ingresos - data.totalesPeriodo.gastos;
  const balanceAnterior = data.totalesAnterior.ingresos - data.totalesAnterior.gastos;
  const rows = [
    ['Ingresos', data.totalesPeriodo.ingresos, data.totalesAnterior.ingresos],
    ['Gastos', data.totalesPeriodo.gastos, data.totalesAnterior.gastos],
    ['Balance', balance, balanceAnterior],
    ['Movimientos', data.txsPeriodo.length, data.txsAnterior.length],
  ].map(function (r) {
    const delta = r[1] - r[2];
    return [r[0], r[1], r[2], delta, r[2] !== 0 ? delta / r[2] : ''];
  });

  sheet.getRange(1, 1, 1, 5).setValues([['Indicador', data.nombrePeriodo, data.nombreAnterior, 'Cambio', 'Cambio %']]);
  sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  aplicarTablaEmail_(sheet, 1, 1, rows.length + 1, 5);
  sheet.getRange('B:D').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('E:E').setNumberFormat('0.00%');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 5);
}

function llenarHojaCategoriasMensualEmail_(sheet, data) {
  sheet.getRange(1, 1, 1, 6).setValues([['Categoria', data.nombrePeriodo, data.nombreAnterior, 'Cambio', 'Cambio %', 'Participacion']]);
  const totalGastos = data.totalesPeriodo.gastos;
  const rows = data.comparativoCategorias.map(function (c) {
    return [
      capitalizar(c.cat),
      c.actual,
      c.anterior,
      c.delta,
      c.anterior !== 0 ? c.delta / c.anterior : '',
      totalGastos > 0 ? c.actual / totalGastos : 0,
    ];
  });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  }

  aplicarTablaEmail_(sheet, 1, 1, Math.max(rows.length + 1, 2), 6);
  sheet.getRange('B:D').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('E:F').setNumberFormat('0.00%');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 6);
}

function llenarHojaSugerenciaIAMensualEmail_(sheet, data) {
  sheet.getRange('A1').setValue('Sugerencia financiera IA');
  sheet.getRange('A2').setValue(data.nombrePeriodo);
  sheet.getRange('A4').setValue(data.sugerenciaIA);
  aplicarTituloEmail_(sheet.getRange('A1:D1'));
  sheet.getRange('A4:D12')
    .merge()
    .setWrap(true)
    .setVerticalAlignment('top')
    .setBorder(true, true, true, true, true, true, '#d1d5db', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setColumnWidths(1, 4, 180);
  sheet.setRowHeights(4, 9, 34);
}

function llenarHojaBaseAnualMensualEmail_(sheet, data) {
  const balance = data.totalesPeriodo.ingresos - data.totalesPeriodo.gastos;
  const top = data.comparativoCategorias[0] || { cat: '', actual: 0, delta: 0 };

  sheet.getRange('A1').setValue('Base para alerta anual');
  sheet.getRange('A3:B12').setValues([
    ['Periodo', data.periodoKey],
    ['Ingresos', data.totalesPeriodo.ingresos],
    ['Gastos', data.totalesPeriodo.gastos],
    ['Balance', balance],
    ['Movimientos', data.txsPeriodo.length],
    ['Categoria principal', capitalizar(top.cat)],
    ['Monto categoria principal', top.actual],
    ['Cambio categoria principal', top.delta],
    ['Nivel alerta', data.alertaAnualBase.nivel],
    ['Senal', data.alertaAnualBase.texto],
  ]);

  aplicarTituloEmail_(sheet.getRange('A1:D1'));
  aplicarSubtituloEmail_(sheet.getRange('A3:B3'));
  sheet.getRange('B4:B6').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('B9:B10').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('A:B').setVerticalAlignment('middle');
  sheet.autoResizeColumns(1, 2);
}

function construirAlertaAnualBaseMensualEmail_(data) {
  const balance = data.totalesPeriodo.ingresos - data.totalesPeriodo.gastos;
  const balanceAnterior = data.totalesAnterior.ingresos - data.totalesAnterior.gastos;
  const top = data.comparativoCategorias[0];
  const motivos = [];
  let nivel = 'OK';

  if (data.totalesPeriodo.ingresos <= 0 && data.txsPeriodo.length > 0) {
    motivos.push('sin ingresos registrados');
    nivel = 'REVISAR';
  }

  if (balance < 0) {
    motivos.push('balance negativo de ' + fmtSignedEmail_(balance));
    nivel = 'ALERTA';
  }

  if (data.totalesPeriodo.gastos > data.totalesAnterior.gastos && data.totalesAnterior.gastos > 0) {
    const deltaGasto = data.totalesPeriodo.gastos - data.totalesAnterior.gastos;
    motivos.push('gastos subieron ' + fmtEmail_(deltaGasto) + ' vs mes anterior');
    if (deltaGasto > data.totalesAnterior.gastos * 0.25) nivel = 'ALERTA';
  }

  if (top && top.participacion >= 0.4) {
    motivos.push(capitalizar(top.cat) + ' concentro ' + fmtPctEmail_(top.participacion) + ' del gasto');
    if (nivel === 'OK') nivel = 'REVISAR';
  }

  const presupuestosExcedidos = data.presupuestos.filter(function (p) {
    return p.limite > 0 && p.gasto > p.limite;
  });

  if (presupuestosExcedidos.length) {
    const principal = presupuestosExcedidos.sort(function (a, b) {
      return (b.gasto - b.limite) - (a.gasto - a.limite);
    })[0];
    motivos.push(capitalizar(principal.cat) + ' excedio presupuesto por ' + fmtEmail_(principal.gasto - principal.limite));
    nivel = 'ALERTA';
  }

  if (balance >= 0 && balanceAnterior < 0) {
    motivos.push('balance mejoro frente al mes anterior');
    if (nivel === 'OK') nivel = 'MEJORA';
  }

  return {
    nivel: nivel,
    texto: motivos.length ? motivos.join('; ') : 'mes estable sin senales fuertes',
  };
}

function guardarCierreMensualEmail_(chatId, data) {
  const sheet = getOrCreateSheet('CierresMensuales', [
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
  ]);
  const top = data.comparativoCategorias[0] || { cat: '', actual: 0, delta: 0 };
  const balance = data.totalesPeriodo.ingresos - data.totalesPeriodo.gastos;
  const rows = sheet.getDataRange().getValues();
  let targetRow = -1;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(chatId) && String(rows[i][1]) === data.periodoKey) {
      targetRow = i + 1;
      break;
    }
  }

  const values = [[
    chatId,
    data.periodoKey,
    data.nombrePeriodo,
    data.totalesPeriodo.ingresos,
    data.totalesPeriodo.gastos,
    balance,
    data.txsPeriodo.length,
    top.cat || '',
    top.actual || 0,
    top.delta || 0,
    data.alertaAnualBase.nivel,
    data.alertaAnualBase.texto,
    data.sugerenciaIA,
    data.generadoEn,
  ]];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, values[0].length).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }

  sheet.getRange(1, 1, 1, values[0].length).setFontWeight('bold');
  sheet.autoResizeColumns(1, values[0].length);
}

function generarSugerenciaMensualIA_(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('claude_api_key');
  if (!apiKey) {
    return sugerenciaMensualFallback_(data, 'No hay claude_api_key configurada.');
  }

  const topCategorias = data.comparativoCategorias.slice(0, 8).map(function (c) {
    return '- ' + c.cat + ': actual ' + fmtEmail_(c.actual) + ', anterior ' + fmtEmail_(c.anterior) + ', cambio ' + fmtDeltaMontoSimpleEmail_(c.delta);
  }).join('\n') || '- Sin gastos por categoria';

  const presupuestos = data.presupuestos.length
    ? data.presupuestos.map(function (p) {
        return '- ' + p.cat + ': gasto ' + fmtEmail_(p.gasto) + ' de limite ' + fmtEmail_(p.limite);
      }).join('\n')
    : '- Sin presupuestos configurados';

  const metas = data.metas.length
    ? data.metas.map(function (m) {
        return '- ' + m.nombre + ': ' + fmtEmail_(m.ahorrado) + ' de ' + fmtEmail_(m.objetivo);
      }).join('\n')
    : '- Sin metas registradas';

  const balance = data.totalesPeriodo.ingresos - data.totalesPeriodo.gastos;
  const balanceAnterior = data.totalesAnterior.ingresos - data.totalesAnterior.gastos;
  const d1 = data.chatId ? leerDashboardD1_(data.chatId) : null;
  const cajaActual = d1 && d1.ok ? fmtEmail_(d1.balance) : 'no disponible';

  const prompt = [
    'Eres un coach de finanzas personales para Mayeson en Peru.',
    'Haz una recomendacion mensual clara usando sus numeros reales.',
    'No recomiendes productos financieros especificos, deuda, trading ni inversiones riesgosas.',
    'Enfocate en habitos, presupuesto, ahorro, control de gastos y proximos pasos concretos.',
    'Si los ingresos del mes son cero, advierte que puede faltar registrar ingresos antes de concluir que no hubo entradas.',
    'Caja actual registrada manda sobre el balance del periodo cuando este disponible.',
    'No diagnostiques caida de ingresos, crisis, sueldo, venta de activos ni gastos financiados con deuda/ahorros si no aparece literalmente.',
    'Balance mensual es flujo registrado del periodo; no lo llames caja disponible.',
    'El texto debe servir tambien como base para una futura alerta anual, asi que deja una senal mensual resumida.',
    '',
    'PERIODO ANALIZADO:',
    data.nombrePeriodo + ' comparado contra ' + data.nombreAnterior,
    '',
    'CAJA ACTUAL:',
    cajaActual,
    '',
    'TOTALES:',
    'Ingresos actual: ' + fmtEmail_(data.totalesPeriodo.ingresos),
    'Gastos actual: ' + fmtEmail_(data.totalesPeriodo.gastos),
    'Balance actual: ' + fmtSignedEmail_(balance),
    'Ingresos anterior: ' + fmtEmail_(data.totalesAnterior.ingresos),
    'Gastos anterior: ' + fmtEmail_(data.totalesAnterior.gastos),
    'Balance anterior: ' + fmtSignedEmail_(balanceAnterior),
    'Movimientos actual: ' + data.txsPeriodo.length,
    'Movimientos anterior: ' + data.txsAnterior.length,
    '',
    'GASTOS POR CATEGORIA:',
    topCategorias,
    '',
    'PRESUPUESTOS:',
    presupuestos,
    '',
    'METAS:',
    metas,
    '',
    'SENAL INTERNA PARA ALERTA ANUAL:',
    data.alertaAnualBase.nivel + ': ' + data.alertaAnualBase.texto,
    '',
    'FORMATO EXACTO:',
    'Diagnostico: una frase con el dato mas importante y, si aplica, la duda de ingresos no registrados.',
    'Comparacion mensual: una frase comparando contra el mes anterior con monto o porcentaje.',
    'Alerta principal: una frase con el riesgo mas importante del mes.',
    'Accion principal: una accion concreta para el proximo mes con monto, categoria o frecuencia.',
    'Plan para el siguiente mes:',
    '1. [accion concreta]',
    '2. [accion concreta]',
    '3. [accion concreta]',
    'Meta del mes: una meta medible para el siguiente mes.',
    'Senal anual: una frase corta para guardar como antecedente anual.',
    'Cierre: una frase breve motivadora.',
  ].join('\n');

  try {
    const props = PropertiesService.getScriptProperties();
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
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      }),
      muteHttpExceptions: true,
    }, 'email mensual /v1/messages');

    let raw = resp.getContentText();
    let responseCode = resp.getResponseCode();
    let chatCompletionsFallback = false;
    if (debeReintentarChatCompletions_(responseCode, raw, claudeUrl)) {
      Logger.log('Email mensual /v1/messages bloqueado; reintentando /v1/chat/completions.');
      resp = llamarIAChatCompletions_(apiKey, claudeUrl, claudeModel, 900, prompt, '', '');
      raw = resp.getContentText();
      responseCode = resp.getResponseCode();
      chatCompletionsFallback = responseCode < 300;
    }

    const result = parseJsonSeguro_(raw, null);
    if (!result) {
      Logger.log('Respuesta mensual IA JSON invalida: ' + raw);
      return sugerenciaMensualFallback_(data, 'Respuesta invalida de IA.');
    }
    if (result.error) {
      Logger.log('Error API mensual: ' + JSON.stringify(result.error));
      return sugerenciaMensualFallback_(data, result.error.message || 'Error de API');
    }

    const bloqueTexto = result.content && result.content.find(function (b) { return b.type === 'text'; });
    const consejoTexto = chatCompletionsFallback
      ? result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content
      : bloqueTexto && bloqueTexto.text;

    if (!consejoTexto) {
      Logger.log('Respuesta mensual IA inesperada: ' + raw);
      return sugerenciaMensualFallback_(data, 'Respuesta vacia de IA.');
    }

    return String(consejoTexto).trim();
  } catch (err) {
    Logger.log('Error generarSugerenciaMensualIA_: ' + err.toString());
    return sugerenciaMensualFallback_(data, err.toString());
  }
}

function sugerenciaMensualFallback_(data, reason) {
  const balance = data.totalesPeriodo.ingresos - data.totalesPeriodo.gastos;
  const balanceAnterior = data.totalesAnterior.ingresos - data.totalesAnterior.gastos;
  const top = data.comparativoCategorias[0];
  const foco = top
    ? 'Tu mayor foco fue ' + capitalizar(top.cat) + ' con ' + fmtEmail_(top.actual) + '.'
    : 'Todavia no hay una categoria dominante para analizar.';
  const ingresosCero = data.totalesPeriodo.ingresos <= 0
    ? ' No hay ingresos registrados; confirma si faltan entradas antes de tomar el balance como definitivo.'
    : '';

  return [
    'Diagnostico: ' + foco + ' El balance del mes fue ' + fmtSignedEmail_(balance) + '.' + ingresosCero,
    'Comparacion mensual: frente al mes anterior, el balance cambio ' + fmtDeltaMontoEmail_(balance, balanceAnterior) + ' y los gastos cambiaron ' + fmtDeltaMontoEmail_(data.totalesPeriodo.gastos, data.totalesAnterior.gastos) + '.',
    'Alerta principal: ' + data.alertaAnualBase.texto,
    'Accion principal: define un limite semanal para la categoria con mas gasto y revisalo cada domingo.',
    'Plan para el siguiente mes:',
    '1. Registra todos los movimientos el mismo dia para que el cierre sea confiable.',
    '2. Separa gastos fijos de variables y revisa si alguno puede bajar.',
    '3. Si hay ingresos, aparta primero un monto pequeno para ahorro antes de gastar.',
    'Meta del mes: mantener el gasto variable por debajo del limite definido y cerrar con balance no negativo.',
    'Senal anual: ' + data.alertaAnualBase.nivel + ' - ' + data.alertaAnualBase.texto,
    'Cierre: poco a poco, con datos limpios, el control se vuelve mucho mas facil.',
    '',
    'Nota tecnica: sugerencia generada sin IA en vivo. Motivo: ' + reason,
  ].join('\n');
}

