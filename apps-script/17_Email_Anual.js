// ---- RESUMEN ANUAL POR CORREO ------------------------------

function enviarResumenAnualEmailAnio_(year, modo, chatIdOverride) {
  const props = PropertiesService.getScriptProperties();
  const emailTo = getEmailTo_('yearly');
  const chatId = chatIdOverride || props.getProperty('dashboard_chat_id') || '1538086276';
  const resumen = construirResumenAnualEmail_(chatId, year, modo);

  MailApp.sendEmail({
    to: emailTo,
    subject: resumen.subject,
    body: resumen.textBody,
    htmlBody: resumen.htmlBody,
    attachments: [resumen.excelBlob],
    name: 'Finanzas Mayeson',
  });

  Logger.log('Resumen anual enviado a ' + emailTo + ' (' + year + ')');
  return 'Resumen anual enviado: ' + year;
}

function construirResumenAnualEmail_(chatId, year, modo) {
  const previousYear = Number(year) - 1;
  const txs = obtenerTransacciones(chatId);
  const txsYear = filtrarTransaccionesAnioEmail_(txs, year);
  const txsPrevious = filtrarTransaccionesAnioEmail_(txs, previousYear);
  const totals = calcularTotalesEmail_(txsYear);
  const previousTotals = calcularTotalesEmail_(txsPrevious);
  const months = construirMesesAnualesEmail_(txsYear, year);
  const previousMonths = construirMesesAnualesEmail_(txsPrevious, previousYear);
  const categories = agruparGastosPorCategoriaEmail_(txsYear);
  const previousCategories = agruparGastosPorCategoriaEmail_(txsPrevious);
  const categoryComparison = compararCategoriasMensualEmail_(categories, previousCategories);
  const cierres = leerCierresMensualesAnioEmail_(chatId, year);

  const data = {
    modo: modo || 'cierre',
    year: Number(year),
    previousYear: previousYear,
    txsYear: txsYear,
    txsPrevious: txsPrevious,
    totals: totals,
    previousTotals: previousTotals,
    months: months,
    previousMonths: previousMonths,
    categories: categories,
    previousCategories: previousCategories,
    categoryComparison: categoryComparison,
    cierres: cierres,
    generadoEn: Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd HH:mm:ss'),
  };

  data.alertaAnual = construirAlertaAnualEmail_(data);
  data.sugerenciaIA = generarSugerenciaAnualIA_(data);

  const subjectPrefix = modo === 'prueba' ? '[Prueba] ' : '';
  const subject = subjectPrefix + 'Alerta financiera anual - ' + year;

  return {
    subject: subject,
    textBody: construirTextoAnualEmail_(data),
    htmlBody: construirHtmlAnualEmail_(data),
    excelBlob: construirExcelAnualEmail_(data),
  };
}

function construirTextoAnualEmail_(data) {
  const balance = data.totals.ingresos - data.totals.gastos;
  const previousBalance = data.previousTotals.ingresos - data.previousTotals.gastos;
  const top = data.categoryComparison[0];
  const monthsNegative = data.months.filter(function (m) { return m.balance < 0; }).length;

  const categorias = data.categoryComparison.length
    ? data.categoryComparison.slice(0, 8).map(function (c) {
        return '- ' + capitalizar(c.cat) + ': ' + fmtEmail_(c.actual) + ' vs ' + fmtEmail_(c.anterior) + ' (' + fmtDeltaMontoSimpleEmail_(c.delta) + ')';
      }).join('\n')
    : '- Sin categorias de gasto';

  return [
    'Alerta financiera anual - ' + data.year,
    'Periodo actual: ' + data.year,
    'Periodo comparado: ' + data.previousYear,
    '',
    'Ingresos: ' + fmtEmail_(data.totals.ingresos) + ' (' + fmtDeltaMontoEmail_(data.totals.ingresos, data.previousTotals.ingresos) + ')',
    'Gastos: ' + fmtEmail_(data.totals.gastos) + ' (' + fmtDeltaMontoEmail_(data.totals.gastos, data.previousTotals.gastos) + ')',
    'Balance: ' + fmtSignedEmail_(balance) + ' (' + fmtDeltaMontoEmail_(balance, previousBalance) + ')',
    'Meses en negativo: ' + monthsNegative,
    'Categoria principal: ' + (top ? capitalizar(top.cat) + ' ' + fmtEmail_(top.actual) : 'Sin datos'),
    '',
    'Nivel de alerta: ' + data.alertaAnual.nivel,
    data.alertaAnual.texto,
    '',
    'Categorias principales',
    categorias,
    '',
    'Sugerencia IA anual',
    data.sugerenciaIA,
    '',
    'Nota: Esta alerta es educativa y de organizacion personal; no reemplaza asesoria financiera profesional.',
  ].join('\n');
}

function construirHtmlAnualEmail_(data) {
  const balance = data.totals.ingresos - data.totals.gastos;
  const previousBalance = data.previousTotals.ingresos - data.previousTotals.gastos;
  const monthsNegative = data.months.filter(function (m) { return m.balance < 0; }).length;
  const colorBalance = balance >= 0 ? '#16a34a' : '#dc2626';
  const iaHtml = escEmail_(data.sugerenciaIA).replace(/\n/g, '<br>');

  const periodosHtml = [
    '<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse">',
    '<tr><td style="color:#6b7280">Anio actual</td><td align="right"><strong>' + escEmail_(data.year) + '</strong></td></tr>',
    '<tr><td style="color:#6b7280">Anio comparado</td><td align="right"><strong>' + escEmail_(data.previousYear) + '</strong></td></tr>',
    '</table>',
  ].join('');

  const comparativoRows = [
    filaComparativoMensualEmail_('Ingresos', data.totals.ingresos, data.previousTotals.ingresos, true),
    filaComparativoMensualEmail_('Gastos', data.totals.gastos, data.previousTotals.gastos, true),
    filaComparativoMensualEmail_('Balance', balance, previousBalance, true),
    filaComparativoMensualEmail_('Movimientos', data.txsYear.length, data.txsPrevious.length, false),
  ].join('');

  const monthsRows = data.months.map(function (m) {
    const color = m.balance >= 0 ? '#16a34a' : '#dc2626';
    return [
      '<tr>',
      '<td>' + escEmail_(m.nombre) + '</td>',
      '<td align="right">' + fmtEmail_(m.ingresos) + '</td>',
      '<td align="right">' + fmtEmail_(m.gastos) + '</td>',
      '<td align="right" style="color:' + color + '"><strong>' + fmtSignedEmail_(m.balance) + '</strong></td>',
      '<td align="right">' + m.movimientos + '</td>',
      '</tr>',
    ].join('');
  }).join('');

  const categoryRows = data.categoryComparison.length
    ? data.categoryComparison.slice(0, 10).map(function (c) {
        const color = c.delta > 0 ? '#dc2626' : c.delta < 0 ? '#16a34a' : '#6b7280';
        return [
          '<tr>',
          '<td>' + escEmail_(capitalizar(c.cat)) + '</td>',
          '<td align="right"><strong>' + fmtEmail_(c.actual) + '</strong></td>',
          '<td align="right">' + fmtEmail_(c.anterior) + '</td>',
          '<td align="right" style="color:' + color + '"><strong>' + fmtDeltaMontoSimpleEmail_(c.delta) + '</strong></td>',
          '</tr>',
        ].join('');
      }).join('')
    : '<tr><td colspan="4" style="color:#6b7280">Sin categorias de gasto.</td></tr>';

  return [
    '<div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827">',
    '<div style="max-width:780px;margin:0 auto;padding:24px">',
    '<div style="background:#111827;color:#f9fafb;border-radius:14px;padding:22px;margin-bottom:16px">',
    '<div style="font-size:12px;text-transform:uppercase;color:#9ca3af">Alerta financiera anual</div>',
    '<h1 style="margin:6px 0 0;font-size:24px">' + escEmail_(data.year) + '</h1>',
    '<div style="font-size:13px;color:#d1d5db;margin-top:8px">Comparativa: ' + escEmail_(data.year) + ' vs ' + escEmail_(data.previousYear) + '</div>',
    '</div>',
    cardsEmail_([
      ['Ingresos', fmtEmail_(data.totals.ingresos), '#16a34a'],
      ['Gastos', fmtEmail_(data.totals.gastos), '#dc2626'],
      ['Balance', fmtSignedEmail_(balance), colorBalance],
      ['Meses negativos', String(monthsNegative), monthsNegative > 0 ? '#dc2626' : '#16a34a'],
    ]),
    seccionEmail_('Periodos comparados', periodosHtml),
    seccionEmail_('Comparativo anual', '<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse"><tr style="background:#f9fafb"><th align="left">Indicador</th><th align="right">' + escEmail_(data.year) + '</th><th align="right">' + escEmail_(data.previousYear) + '</th><th align="right">Cambio</th></tr>' + comparativoRows + '</table>'),
    seccionEmail_('Alerta anual', '<p style="margin:0;line-height:1.55"><strong>' + escEmail_(data.alertaAnual.nivel) + ':</strong> ' + escEmail_(data.alertaAnual.texto) + '</p>'),
    seccionEmail_('Mes a mes', '<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse"><tr style="background:#f9fafb"><th align="left">Mes</th><th align="right">Ingresos</th><th align="right">Gastos</th><th align="right">Balance</th><th align="right">Mov.</th></tr>' + monthsRows + '</table>'),
    seccionEmail_('Categorias principales', '<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse"><tr style="background:#f9fafb"><th align="left">Categoria</th><th align="right">' + escEmail_(data.year) + '</th><th align="right">' + escEmail_(data.previousYear) + '</th><th align="right">Cambio</th></tr>' + categoryRows + '</table>'),
    seccionEmail_('Sugerencia IA anual', '<div style="line-height:1.55;font-size:14px">' + iaHtml + '</div><p style="font-size:12px;color:#6b7280;margin:14px 0 0">Contenido educativo para organizacion personal. No reemplaza asesoria financiera profesional.</p>'),
    '<p style="font-size:12px;color:#6b7280;text-align:center;margin-top:18px">Archivo Excel adjunto generado el ' + escEmail_(data.generadoEn) + '.</p>',
    '</div>',
    '</div>',
  ].join('');
}

function construirExcelAnualEmail_(data) {
  const fileName = 'finanzas_resumen_anual_' + data.year;
  const ss = SpreadsheetApp.create(fileName);

  try {
    const resumenSheet = ss.getSheets()[0];
    resumenSheet.setName('Resumen');
    llenarHojaResumenAnualEmail_(resumenSheet, data);

    const mesesSheet = ss.insertSheet('Meses');
    llenarHojaMesesAnualEmail_(mesesSheet, data);

    const catSheet = ss.insertSheet('Categorias');
    llenarHojaCategoriasAnualEmail_(catSheet, data);

    const cierresSheet = ss.insertSheet('Cierres');
    llenarHojaCierresAnualEmail_(cierresSheet, data);

    const txSheet = ss.insertSheet('Transacciones');
    llenarHojaTransaccionesEmail_(txSheet, data.txsYear);

    const iaSheet = ss.insertSheet('Sugerencia IA');
    llenarHojaSugerenciaIAAnualEmail_(iaSheet, data);

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

function llenarHojaResumenAnualEmail_(sheet, data) {
  const balance = data.totals.ingresos - data.totals.gastos;
  const previousBalance = data.previousTotals.ingresos - data.previousTotals.gastos;

  sheet.getRange('A1').setValue('Alerta financiera anual');
  sheet.getRange('A2').setValue(String(data.year) + ' vs ' + String(data.previousYear));
  sheet.getRange('A4:B11').setValues([
    ['Indicador', String(data.year)],
    ['Ingresos', data.totals.ingresos],
    ['Gastos', data.totals.gastos],
    ['Balance', balance],
    ['Movimientos', data.txsYear.length],
    ['Nivel alerta', data.alertaAnual.nivel],
    ['Senal', data.alertaAnual.texto],
    ['Generado', data.generadoEn],
  ]);

  sheet.getRange('D4:E8').setValues([
    ['Indicador', String(data.previousYear)],
    ['Ingresos', data.previousTotals.ingresos],
    ['Gastos', data.previousTotals.gastos],
    ['Balance', previousBalance],
    ['Movimientos', data.txsPrevious.length],
  ]);

  aplicarTituloEmail_(sheet.getRange('A1:E1'));
  aplicarSubtituloEmail_(sheet.getRange('A4:B4'));
  aplicarSubtituloEmail_(sheet.getRange('D4:E4'));
  sheet.getRange('B5:B7').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('E5:E7').setNumberFormat('"S/ "#,##0.00');
  sheet.autoResizeColumns(1, 5);
}

function llenarHojaMesesAnualEmail_(sheet, data) {
  const rows = data.months.map(function (m) {
    return [m.key, m.nombre, m.ingresos, m.gastos, m.balance, m.movimientos, m.categoriaPrincipal, m.montoCategoriaPrincipal];
  });

  sheet.getRange(1, 1, 1, 8).setValues([['Mes', 'Nombre', 'Ingresos', 'Gastos', 'Balance', 'Movimientos', 'Categoria principal', 'Monto categoria']]);
  if (rows.length) sheet.getRange(2, 1, rows.length, 8).setValues(rows);
  aplicarTablaEmail_(sheet, 1, 1, Math.max(rows.length + 1, 2), 8);
  sheet.getRange('C:E').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('H:H').setNumberFormat('"S/ "#,##0.00');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 8);
}

function llenarHojaCategoriasAnualEmail_(sheet, data) {
  const rows = data.categoryComparison.map(function (c) {
    return [capitalizar(c.cat), c.actual, c.anterior, c.delta, c.anterior !== 0 ? c.delta / c.anterior : '', c.participacion];
  });

  sheet.getRange(1, 1, 1, 6).setValues([['Categoria', String(data.year), String(data.previousYear), 'Cambio', 'Cambio %', 'Participacion']]);
  if (rows.length) sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  aplicarTablaEmail_(sheet, 1, 1, Math.max(rows.length + 1, 2), 6);
  sheet.getRange('B:D').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('E:F').setNumberFormat('0.00%');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 6);
}

function llenarHojaCierresAnualEmail_(sheet, data) {
  sheet.getRange(1, 1, 1, 7).setValues([['Periodo', 'Ingresos', 'Gastos', 'Balance', 'Nivel alerta', 'Senal anual', 'Actualizado']]);

  if (data.cierres.length) {
    const rows = data.cierres.map(function (c) {
      return [c.periodo, c.ingresos, c.gastos, c.balance, c.nivel, c.senal, c.actualizado];
    });
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }

  aplicarTablaEmail_(sheet, 1, 1, Math.max(data.cierres.length + 1, 2), 7);
  sheet.getRange('B:D').setNumberFormat('"S/ "#,##0.00');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 7);
}

function llenarHojaSugerenciaIAAnualEmail_(sheet, data) {
  sheet.getRange('A1').setValue('Sugerencia IA anual');
  sheet.getRange('A2').setValue(String(data.year));
  sheet.getRange('A4').setValue(data.sugerenciaIA);
  aplicarTituloEmail_(sheet.getRange('A1:D1'));
  sheet.getRange('A4:D14')
    .merge()
    .setWrap(true)
    .setVerticalAlignment('top')
    .setBorder(true, true, true, true, true, true, '#d1d5db', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setColumnWidths(1, 4, 180);
  sheet.setRowHeights(4, 11, 34);
}

function generarSugerenciaAnualIA_(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('claude_api_key');
  if (!apiKey) {
    return sugerenciaAnualFallback_(data, 'No hay claude_api_key configurada.');
  }

  const months = data.months.map(function (m) {
    return '- ' + m.nombre + ': ingresos ' + fmtEmail_(m.ingresos) + ', gastos ' + fmtEmail_(m.gastos) + ', balance ' + fmtSignedEmail_(m.balance);
  }).join('\n');

  const categories = data.categoryComparison.slice(0, 8).map(function (c) {
    return '- ' + c.cat + ': actual ' + fmtEmail_(c.actual) + ', anterior ' + fmtEmail_(c.anterior) + ', cambio ' + fmtDeltaMontoSimpleEmail_(c.delta);
  }).join('\n') || '- Sin categorias';

  const cierres = data.cierres.length
    ? data.cierres.map(function (c) {
        return '- ' + c.periodo + ': ' + c.nivel + ' - ' + c.senal;
      }).join('\n')
    : '- Sin cierres mensuales guardados todavia';

  const balance = data.totals.ingresos - data.totals.gastos;
  const previousBalance = data.previousTotals.ingresos - data.previousTotals.gastos;

  const prompt = [
    'Eres un coach de finanzas personales para Mayeson en Peru.',
    'Genera una alerta financiera anual clara, accionable y prudente.',
    'No recomiendes productos financieros especificos, deuda, trading ni inversiones riesgosas.',
    'Si el anio aun no esta completo, dilo como acumulado del anio y evita conclusiones definitivas.',
    '',
    'ANIO ANALIZADO: ' + data.year + ' comparado contra ' + data.previousYear,
    'Ingresos: ' + fmtEmail_(data.totals.ingresos) + ' vs ' + fmtEmail_(data.previousTotals.ingresos),
    'Gastos: ' + fmtEmail_(data.totals.gastos) + ' vs ' + fmtEmail_(data.previousTotals.gastos),
    'Balance: ' + fmtSignedEmail_(balance) + ' vs ' + fmtSignedEmail_(previousBalance),
    'Movimientos: ' + data.txsYear.length + ' vs ' + data.txsPrevious.length,
    '',
    'ALERTA CALCULADA:',
    data.alertaAnual.nivel + ': ' + data.alertaAnual.texto,
    '',
    'MES A MES:',
    months,
    '',
    'CATEGORIAS:',
    categories,
    '',
    'CIERRES MENSUALES GUARDADOS:',
    cierres,
    '',
    'FORMATO EXACTO:',
    'Diagnostico anual: una frase con el estado general.',
    'Comparacion anual: una frase comparando contra el anio anterior.',
    'Alerta anual: el riesgo o patron mas importante.',
    'Prioridades del proximo anio:',
    '1. [prioridad concreta]',
    '2. [prioridad concreta]',
    '3. [prioridad concreta]',
    'Meta anual: una meta medible.',
    'Primer paso: una accion para hacer esta semana.',
    'Cierre: una frase breve motivadora.',
  ].join('\n');

  try {
    const resp = fetchIAConReintentos_('https://api.synterolink.com/v1/messages', {
      method: 'post',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 950,
        messages: [{ role: 'user', content: prompt }],
      }),
      muteHttpExceptions: true,
    }, 'email anual /v1/messages');

    const result = JSON.parse(resp.getContentText());
    if (result.error) {
      Logger.log('Error API anual: ' + JSON.stringify(result.error));
      return sugerenciaAnualFallback_(data, result.error.message || 'Error de API');
    }

    const consejo = result.content && result.content.find(function (b) {
      return b.type === 'text';
    });

    if (!consejo || !consejo.text) {
      Logger.log('Respuesta anual IA inesperada: ' + resp.getContentText());
      return sugerenciaAnualFallback_(data, 'Respuesta vacia de IA.');
    }

    return String(consejo.text).trim();
  } catch (err) {
    Logger.log('Error generarSugerenciaAnualIA_: ' + err.toString());
    return sugerenciaAnualFallback_(data, err.toString());
  }
}

function sugerenciaAnualFallback_(data, reason) {
  const balance = data.totals.ingresos - data.totals.gastos;

  return [
    'Diagnostico anual: el balance acumulado fue ' + fmtSignedEmail_(balance) + ' con gastos de ' + fmtEmail_(data.totals.gastos) + '.',
    'Comparacion anual: revisa la tabla comparativa para validar si el cambio contra ' + data.previousYear + ' viene de ingresos, gastos o ambos.',
    'Alerta anual: ' + data.alertaAnual.texto,
    'Prioridades del proximo anio:',
    '1. Mantener registro mensual completo para que cada alerta anual tenga base real.',
    '2. Reducir la categoria principal si concentra demasiado gasto.',
    '3. Definir una meta anual de ahorro y revisarla cada cierre mensual.',
    'Meta anual: cerrar el anio con balance positivo y al menos 10 meses registrados.',
    'Primer paso: revisa esta semana si faltan ingresos o gastos por registrar.',
    'Cierre: con cierres mensuales constantes, el anual deja de ser sorpresa.',
    '',
    'Nota tecnica: sugerencia generada sin IA en vivo. Motivo: ' + reason,
  ].join('\n');
}

function construirAlertaAnualEmail_(data) {
  const balance = data.totals.ingresos - data.totals.gastos;
  const previousBalance = data.previousTotals.ingresos - data.previousTotals.gastos;
  const monthsNegative = data.months.filter(function (m) { return m.balance < 0; }).length;
  const monthsWithNoIncome = data.months.filter(function (m) { return m.movimientos > 0 && m.ingresos <= 0; }).length;
  const top = data.categoryComparison[0];
  const monthlyAlerts = data.cierres.filter(function (c) { return c.nivel === 'ALERTA'; }).length;
  const motivos = [];
  let nivel = 'OK';

  if (balance < 0) {
    motivos.push('balance anual negativo de ' + fmtSignedEmail_(balance));
    nivel = 'ALERTA';
  }

  if (monthsNegative >= 3) {
    motivos.push(monthsNegative + ' meses cerraron en negativo');
    nivel = 'ALERTA';
  }

  if (monthsWithNoIncome >= 2) {
    motivos.push(monthsWithNoIncome + ' meses con movimientos pero sin ingresos registrados');
    if (nivel === 'OK') nivel = 'REVISAR';
  }

  if (top && data.totals.gastos > 0 && top.actual / data.totals.gastos >= 0.4) {
    motivos.push(capitalizar(top.cat) + ' concentro ' + fmtPctEmail_(top.actual / data.totals.gastos) + ' del gasto anual');
    if (nivel === 'OK') nivel = 'REVISAR';
  }

  if (monthlyAlerts >= 3) {
    motivos.push(monthlyAlerts + ' cierres mensuales quedaron en ALERTA');
    nivel = 'ALERTA';
  }

  if (balance >= 0 && previousBalance < 0) {
    motivos.push('balance anual mejoro frente al anio anterior');
    if (nivel === 'OK') nivel = 'MEJORA';
  }

  return {
    nivel: nivel,
    texto: motivos.length ? motivos.join('; ') : 'anio estable sin senales fuertes',
  };
}

function construirMesesAnualesEmail_(txs, year) {
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  return meses.map(function (name, index) {
    const key = String(year) + '-' + String(index + 1).padStart(2, '0');
    const rows = txs.filter(function (r) {
      return keyMesFilaEmail_(r[0]) === key;
    });
    const totals = calcularTotalesEmail_(rows);
    const cats = agruparGastosPorCategoriaEmail_(rows);
    const top = cats[0] || { cat: '', monto: 0 };

    return {
      key: key,
      nombre: name,
      ingresos: totals.ingresos,
      gastos: totals.gastos,
      balance: totals.ingresos - totals.gastos,
      movimientos: rows.length,
      categoriaPrincipal: top.cat,
      montoCategoriaPrincipal: top.monto,
    };
  });
}

function leerCierresMensualesAnioEmail_(chatId, year) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('CierresMensuales');
  if (!sheet || sheet.getLastRow() < 2) return [];

  return sheet.getDataRange().getValues().slice(1)
    .filter(function (r) {
      return String(r[0]) === String(chatId) && String(r[1]).indexOf(String(year) + '-') === 0;
    })
    .map(function (r) {
      return {
        periodo: String(r[1] || ''),
        ingresos: parseFloat(r[3]) || 0,
        gastos: parseFloat(r[4]) || 0,
        balance: parseFloat(r[5]) || 0,
        nivel: String(r[10] || ''),
        senal: String(r[11] || ''),
        actualizado: String(r[13] || ''),
      };
    })
    .sort(function (a, b) {
      return a.periodo.localeCompare(b.periodo);
    });
}

function filtrarTransaccionesAnioEmail_(txs, year) {
  return txs.filter(function (r) {
    return keyMesFilaEmail_(r[0]).indexOf(String(year) + '-') === 0;
  });
}

function compararCategoriasMensualEmail_(actual, anterior) {
  const map = {};
  const totalActual = actual.reduce(function (acc, c) { return acc + c.monto; }, 0);

  actual.forEach(function (c) {
    const key = String(c.cat || 'otro').toLowerCase();
    if (!map[key]) map[key] = { cat: key, actual: 0, anterior: 0 };
    map[key].actual = c.monto;
  });

  anterior.forEach(function (c) {
    const key = String(c.cat || 'otro').toLowerCase();
    if (!map[key]) map[key] = { cat: key, actual: 0, anterior: 0 };
    map[key].anterior = c.monto;
  });

  return Object.keys(map).map(function (key) {
    const item = map[key];
    item.delta = item.actual - item.anterior;
    item.participacion = totalActual > 0 ? item.actual / totalActual : 0;
    return item;
  }).sort(function (a, b) {
    return b.actual - a.actual || Math.abs(b.delta) - Math.abs(a.delta);
  });
}

function filtrarTransaccionesMesEmail_(txs, mesKey) {
  return txs.filter(function (r) {
    return keyMesFilaEmail_(r[0]) === mesKey;
  });
}

function keyMesFilaEmail_(value) {
  const date = Object.prototype.toString.call(value) === '[object Date]'
    ? value
    : new Date(value);

  if (isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, 'America/Lima', 'yyyy-MM');
}

function inicioMesEmail_(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function mesRelativoEmail_(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function nombreMesAnioEmail_(date) {
  return nombreMesEmail_(date) + ' ' + Utilities.formatDate(date, 'America/Lima', 'yyyy');
}

function fmtPctEmail_(value) {
  return (Number(value) || 0).toLocaleString('es-PE', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function fmtDeltaMontoEmail_(actual, anterior) {
  return fmtDeltaMontoSimpleEmail_(Number(actual || 0) - Number(anterior || 0));
}

function fmtDeltaMontoSimpleEmail_(delta) {
  const value = Number(delta || 0);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return sign + fmtEmail_(Math.abs(value));
}

function fmtDeltaNumeroEmail_(actual, anterior) {
  return fmtDeltaNumeroSimpleEmail_(Number(actual || 0) - Number(anterior || 0));
}

function fmtDeltaNumeroSimpleEmail_(delta) {
  const value = Number(delta || 0);
  const sign = value > 0 ? '+' : '';
  return sign + String(value);
}

