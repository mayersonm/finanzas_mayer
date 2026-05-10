// ---- RESUMEN DIARIO POR CORREO: CONSTRUCCION ----------------

function construirResumenDiarioEmail_(chatId) {
  const hoy = new Date();
  const fechaKey = Utilities.formatDate(hoy, 'America/Lima', 'yyyy-MM-dd');
  const fechaLarga = Utilities.formatDate(hoy, 'America/Lima', 'dd/MM/yyyy');
  const mesKey = Utilities.formatDate(hoy, 'America/Lima', 'yyyy-MM');
  const nombreMes = nombreMesEmail_(hoy);

  const txs = obtenerTransacciones(chatId);
  const txsHoy = txs.filter(function (r) {
    return Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM-dd') === fechaKey;
  });

  const txsMes = txs.filter(function (r) {
    return Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM') === mesKey;
  });

  const totalesHoy = calcularTotalesEmail_(txsHoy);
  const totalesMes = calcularTotalesEmail_(txsMes);
  const categoriasHoy = agruparGastosPorCategoriaEmail_(txsHoy);
  const presupuestos = obtenerPresupuestosEmail_(chatId, mesKey);
  const metas = obtenerMetasEmail_(chatId);

  const subject = 'Resumen financiero diario - ' + fechaLarga;
  const textBody = construirTextoEmail_({
    fechaLarga: fechaLarga,
    nombreMes: nombreMes,
    txsHoy: txsHoy,
    totalesHoy: totalesHoy,
    totalesMes: totalesMes,
    categoriasHoy: categoriasHoy,
    presupuestos: presupuestos,
    metas: metas,
  });

  const htmlBody = construirHtmlEmail_({
    fechaLarga: fechaLarga,
    nombreMes: nombreMes,
    txsHoy: txsHoy,
    totalesHoy: totalesHoy,
    totalesMes: totalesMes,
    categoriasHoy: categoriasHoy,
    presupuestos: presupuestos,
    metas: metas,
  });
  const excelBlob = construirExcelDiarioEmail_({
    fechaKey: fechaKey,
    fechaLarga: fechaLarga,
    nombreMes: nombreMes,
    txsHoy: txsHoy,
    totalesHoy: totalesHoy,
    totalesMes: totalesMes,
    categoriasHoy: categoriasHoy,
    presupuestos: presupuestos,
    metas: metas,
  });

  return {
    subject: subject,
    textBody: textBody,
    htmlBody: htmlBody,
    excelBlob: excelBlob,
  };
}

function construirTextoEmail_(data) {
  const balanceHoy = data.totalesHoy.ingresos - data.totalesHoy.gastos;
  const balanceMes = data.totalesMes.ingresos - data.totalesMes.gastos;
  const categorias = data.categoriasHoy.length
    ? data.categoriasHoy.map(function (c) {
        return '- ' + capitalizar(c.cat) + ': ' + fmtEmail_(c.monto);
      }).join('\n')
    : '- Sin gastos por categoria hoy';

  const movimientos = data.txsHoy.length
    ? data.txsHoy.map(function (r) {
        return '- ' + r[2] + ' | ' + r[3] + ' | ' + fmtEmail_(parseFloat(r[5]) || 0);
      }).join('\n')
    : '- No registraste movimientos hoy';

  return [
    'Resumen financiero diario - ' + data.fechaLarga,
    '',
    'Hoy',
    'Ingresos: ' + fmtEmail_(data.totalesHoy.ingresos),
    'Gastos: ' + fmtEmail_(data.totalesHoy.gastos),
    'Balance: ' + fmtSignedEmail_(balanceHoy),
    '',
    'Categorias',
    categorias,
    '',
    'Movimientos',
    movimientos,
    '',
    'Mes de ' + data.nombreMes,
    'Ingresos: ' + fmtEmail_(data.totalesMes.ingresos),
    'Gastos: ' + fmtEmail_(data.totalesMes.gastos),
    'Balance: ' + fmtSignedEmail_(balanceMes),
  ].join('\n');
}

function construirHtmlEmail_(data) {
  const balanceHoy = data.totalesHoy.ingresos - data.totalesHoy.gastos;
  const balanceMes = data.totalesMes.ingresos - data.totalesMes.gastos;
  const colorBalanceHoy = balanceHoy >= 0 ? '#16a34a' : '#dc2626';
  const colorBalanceMes = balanceMes >= 0 ? '#16a34a' : '#dc2626';

  const categoriasRows = data.categoriasHoy.length
    ? data.categoriasHoy.map(function (c) {
        return '<tr><td>' + escEmail_(capitalizar(c.cat)) + '</td><td align="right"><strong>' + fmtEmail_(c.monto) + '</strong></td></tr>';
      }).join('')
    : '<tr><td colspan="2" style="color:#6b7280">Sin gastos por categoria hoy</td></tr>';

  const txRows = data.txsHoy.length
    ? data.txsHoy.map(function (r) {
        const tipo = String(r[2]);
        const color = tipo === 'ingreso' ? '#16a34a' : '#dc2626';
        const signo = tipo === 'ingreso' ? '+' : '-';
        return [
          '<tr>',
          '<td><strong>' + escEmail_(r[3]) + '</strong><br><span style="color:#6b7280">' + escEmail_(r[4]) + '</span></td>',
          '<td align="right" style="color:' + color + '"><strong>' + signo + fmtEmail_(parseFloat(r[5]) || 0) + '</strong></td>',
          '</tr>',
        ].join('');
      }).join('')
    : '<tr><td colspan="2" style="color:#6b7280">No registraste movimientos hoy.</td></tr>';

  const presupuestosHtml = data.presupuestos.length
    ? data.presupuestos.map(function (p) {
        const pct = p.limite > 0 ? Math.min(Math.round((p.gasto / p.limite) * 100), 100) : 0;
        const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : '#16a34a';
        return [
          '<div style="margin:10px 0 14px">',
          '<div style="display:flex;justify-content:space-between;font-size:13px">',
          '<strong>' + escEmail_(capitalizar(p.cat)) + '</strong>',
          '<span>' + fmtEmail_(p.gasto) + ' / ' + fmtEmail_(p.limite) + '</span>',
          '</div>',
          '<div style="height:8px;background:#e5e7eb;border-radius:999px;margin-top:6px;overflow:hidden">',
          '<div style="width:' + pct + '%;height:8px;background:' + color + ';border-radius:999px"></div>',
          '</div>',
          '<div style="font-size:12px;color:' + color + ';margin-top:4px">' + pct + '% usado</div>',
          '</div>',
        ].join('');
      }).join('')
    : '<p style="color:#6b7280;margin:0">Sin presupuestos configurados.</p>';

  const metasHtml = data.metas.length
    ? data.metas.map(function (m) {
        const pct = m.objetivo > 0 ? Math.min(Math.round((m.ahorrado / m.objetivo) * 100), 100) : 0;
        return [
          '<div style="margin:10px 0 14px">',
          '<div style="display:flex;justify-content:space-between;font-size:13px">',
          '<strong>' + escEmail_(capitalizar(m.nombre)) + '</strong>',
          '<span>' + fmtEmail_(m.ahorrado) + ' / ' + fmtEmail_(m.objetivo) + '</span>',
          '</div>',
          '<div style="height:8px;background:#e5e7eb;border-radius:999px;margin-top:6px;overflow:hidden">',
          '<div style="width:' + pct + '%;height:8px;background:#2563eb;border-radius:999px"></div>',
          '</div>',
          '<div style="font-size:12px;color:#2563eb;margin-top:4px">' + pct + '% completado</div>',
          '</div>',
        ].join('');
      }).join('')
    : '<p style="color:#6b7280;margin:0">Sin metas registradas.</p>';

  return [
    '<div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827">',
    '<div style="max-width:680px;margin:0 auto;padding:24px">',
    '<div style="background:#111827;color:#f9fafb;border-radius:14px;padding:22px;margin-bottom:16px">',
    '<div style="font-size:12px;text-transform:uppercase;color:#9ca3af">Resumen financiero diario</div>',
    '<h1 style="margin:6px 0 0;font-size:24px">' + escEmail_(data.fechaLarga) + '</h1>',
    '</div>',
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">',
    cardEmail_('Ingresos hoy', fmtEmail_(data.totalesHoy.ingresos), '#16a34a'),
    cardEmail_('Gastos hoy', fmtEmail_(data.totalesHoy.gastos), '#dc2626'),
    cardEmail_('Balance hoy', fmtSignedEmail_(balanceHoy), colorBalanceHoy),
    '</div>',
    seccionEmail_('Movimientos de hoy', '<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse">' + txRows + '</table>'),
    seccionEmail_('Gastos por categoria', '<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse">' + categoriasRows + '</table>'),
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0">',
    cardEmail_('Ingresos ' + data.nombreMes, fmtEmail_(data.totalesMes.ingresos), '#16a34a'),
    cardEmail_('Gastos ' + data.nombreMes, fmtEmail_(data.totalesMes.gastos), '#dc2626'),
    cardEmail_('Balance mes', fmtSignedEmail_(balanceMes), colorBalanceMes),
    '</div>',
    seccionEmail_('Presupuestos', presupuestosHtml),
    seccionEmail_('Metas', metasHtml),
    '<p style="font-size:12px;color:#6b7280;text-align:center;margin-top:18px">Enviado automaticamente por tu bot de finanzas.</p>',
    '</div>',
    '</div>',
  ].join('');
}

function cardEmail_(label, value, color) {
  return [
    '<div style="background:#ffffff;border-radius:12px;padding:16px;border:1px solid #e5e7eb">',
    '<div style="font-size:11px;text-transform:uppercase;color:#6b7280">' + escEmail_(label) + '</div>',
    '<div style="font-size:22px;font-weight:700;color:' + color + ';margin-top:6px">' + escEmail_(value) + '</div>',
    '</div>',
  ].join('');
}

function seccionEmail_(title, content) {
  return [
    '<div style="background:#ffffff;border-radius:12px;padding:18px;border:1px solid #e5e7eb;margin-bottom:16px">',
    '<h2 style="font-size:16px;margin:0 0 12px">' + escEmail_(title) + '</h2>',
    content,
    '</div>',
  ].join('');
}

function calcularTotalesEmail_(txs) {
  return txs.reduce(function (acc, r) {
    const monto = parseFloat(r[5]) || 0;
    if (r[2] === 'ingreso') acc.ingresos += monto;
    if (r[2] === 'gasto') acc.gastos += monto;
    return acc;
  }, { ingresos: 0, gastos: 0 });
}

function agruparGastosPorCategoriaEmail_(txs) {
  const map = {};

  txs.forEach(function (r) {
    if (r[2] !== 'gasto') return;
    const cat = String(r[4] || 'otro').toLowerCase();
    map[cat] = (map[cat] || 0) + (parseFloat(r[5]) || 0);
  });

  return Object.keys(map)
    .map(function (cat) {
      return { cat: cat, monto: map[cat] };
    })
    .sort(function (a, b) {
      return b.monto - a.monto;
    });
}

function obtenerPresupuestosEmail_(chatId, mesKey) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Presupuestos');
  if (!sheet) return [];

  const gastos = (obtenerGastosPorMesCat(chatId, mesKey)[mesKey]) || {};

  return sheet.getDataRange().getValues().slice(1)
    .filter(function (r) {
      return String(r[0]) === String(chatId);
    })
    .map(function (r) {
      const cat = String(r[1] || 'otro').toLowerCase();
      return {
        cat: cat,
        limite: parseFloat(r[2]) || 0,
        gasto: gastos[cat] || 0,
      };
    })
    .filter(function (p) {
      return p.limite > 0;
    });
}

function obtenerMetasEmail_(chatId) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Metas');
  if (!sheet) return [];

  return sheet.getDataRange().getValues().slice(1)
    .filter(function (r) {
      return String(r[0]) === String(chatId);
    })
    .map(function (r) {
      return {
        nombre: String(r[1] || ''),
        objetivo: parseFloat(r[2]) || 0,
        ahorrado: parseFloat(r[3]) || 0,
      };
    })
    .filter(function (m) {
      return m.nombre && m.objetivo > 0;
    });
}

function construirExcelDiarioEmail_(data) {
  const fileName = 'finanzas_resumen_diario_' + data.fechaKey;
  const ss = SpreadsheetApp.create(fileName);

  try {
    const resumenSheet = ss.getSheets()[0];
    resumenSheet.setName('Resumen');
    llenarHojaResumenEmail_(resumenSheet, data);

    const txSheet = ss.insertSheet('Transacciones');
    llenarHojaTransaccionesEmail_(txSheet, data.txsHoy);

    const catSheet = ss.insertSheet('Categorias');
    llenarHojaCategoriasEmail_(catSheet, data.categoriasHoy);

    const presSheet = ss.insertSheet('Presupuestos');
    llenarHojaPresupuestosEmail_(presSheet, data.presupuestos);

    const metasSheet = ss.insertSheet('Metas');
    llenarHojaMetasEmail_(metasSheet, data.metas);

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

function llenarHojaResumenEmail_(sheet, data) {
  const balanceHoy = data.totalesHoy.ingresos - data.totalesHoy.gastos;
  const balanceMes = data.totalesMes.ingresos - data.totalesMes.gastos;

  sheet.getRange('A1').setValue('Resumen financiero diario');
  sheet.getRange('A2').setValue(data.fechaLarga);

  sheet.getRange('A4:B7').setValues([
    ['Indicador', 'Monto'],
    ['Ingresos hoy', data.totalesHoy.ingresos],
    ['Gastos hoy', data.totalesHoy.gastos],
    ['Balance hoy', balanceHoy],
  ]);

  sheet.getRange('D4:E7').setValues([
    ['Indicador', 'Monto'],
    ['Ingresos ' + data.nombreMes, data.totalesMes.ingresos],
    ['Gastos ' + data.nombreMes, data.totalesMes.gastos],
    ['Balance mes', balanceMes],
  ]);

  sheet.getRange('A9').setValue('Movimientos del dia');
  sheet.getRange('B9').setValue(data.txsHoy.length);
  sheet.getRange('A10').setValue('Archivo generado');
  sheet.getRange('B10').setValue(Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd HH:mm:ss'));

  sheet.setFrozenRows(4);
  aplicarTituloEmail_(sheet.getRange('A1:E1'));
  aplicarSubtituloEmail_(sheet.getRange('A4:B4'));
  aplicarSubtituloEmail_(sheet.getRange('D4:E4'));
  aplicarSubtituloEmail_(sheet.getRange('A9:B10'));
  sheet.getRange('B5:B7').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('E5:E7').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('A:E').setVerticalAlignment('middle');
  sheet.autoResizeColumns(1, 5);
}

function llenarHojaTransaccionesEmail_(sheet, txs) {
  sheet.getRange(1, 1, 1, 7).setValues([[
    'Fecha',
    'Hora',
    'Tipo',
    'Descripcion',
    'Categoria',
    'Monto',
    'Origen',
  ]]);

  if (txs.length) {
    const rows = txs.map(function (r) {
      return [
        Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM-dd'),
        Utilities.formatDate(new Date(r[1]), 'America/Lima', 'HH:mm'),
        r[2],
        r[3],
        r[4],
        parseFloat(r[5]) || 0,
        'Telegram',
      ];
    });
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }

  aplicarTablaEmail_(sheet, 1, 1, Math.max(txs.length + 1, 2), 7);
  sheet.getRange('F:F').setNumberFormat('"S/ "#,##0.00');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 7);
}

function llenarHojaCategoriasEmail_(sheet, categorias) {
  sheet.getRange(1, 1, 1, 3).setValues([['Categoria', 'Monto', 'Participacion']]);
  const total = categorias.reduce(function (acc, c) { return acc + c.monto; }, 0);

  if (categorias.length) {
    const rows = categorias.map(function (c) {
      return [capitalizar(c.cat), c.monto, total > 0 ? c.monto / total : 0];
    });
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }

  aplicarTablaEmail_(sheet, 1, 1, Math.max(categorias.length + 1, 2), 3);
  sheet.getRange('B:B').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('C:C').setNumberFormat('0.00%');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 3);
}

function llenarHojaPresupuestosEmail_(sheet, presupuestos) {
  sheet.getRange(1, 1, 1, 5).setValues([['Categoria', 'Limite', 'Gasto', 'Disponible', 'Uso']]);

  if (presupuestos.length) {
    const rows = presupuestos.map(function (p) {
      return [
        capitalizar(p.cat),
        p.limite,
        p.gasto,
        p.limite - p.gasto,
        p.limite > 0 ? p.gasto / p.limite : 0,
      ];
    });
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  }

  aplicarTablaEmail_(sheet, 1, 1, Math.max(presupuestos.length + 1, 2), 5);
  sheet.getRange('B:D').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('E:E').setNumberFormat('0.00%');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 5);
}

function llenarHojaMetasEmail_(sheet, metas) {
  sheet.getRange(1, 1, 1, 5).setValues([['Meta', 'Objetivo', 'Ahorrado', 'Faltante', 'Avance']]);

  if (metas.length) {
    const rows = metas.map(function (m) {
      return [
        capitalizar(m.nombre),
        m.objetivo,
        m.ahorrado,
        m.objetivo - m.ahorrado,
        m.objetivo > 0 ? m.ahorrado / m.objetivo : 0,
      ];
    });
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  }

  aplicarTablaEmail_(sheet, 1, 1, Math.max(metas.length + 1, 2), 5);
  sheet.getRange('B:D').setNumberFormat('"S/ "#,##0.00');
  sheet.getRange('E:E').setNumberFormat('0.00%');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 5);
}

function aplicarTituloEmail_(range) {
  range
    .merge()
    .setBackground('#111827')
    .setFontColor('#ffffff')
    .setFontSize(16)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
}

function aplicarSubtituloEmail_(range) {
  range
    .setBackground('#e5e7eb')
    .setFontWeight('bold')
    .setBorder(true, true, true, true, true, true, '#d1d5db', SpreadsheetApp.BorderStyle.SOLID);
}

function aplicarTablaEmail_(sheet, row, col, numRows, numCols) {
  const header = sheet.getRange(row, col, 1, numCols);
  header
    .setBackground('#111827')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sheet.getRange(row, col, numRows, numCols)
    .setBorder(true, true, true, true, true, true, '#d1d5db', SpreadsheetApp.BorderStyle.SOLID)
    .setVerticalAlignment('middle');

  if (numRows > 1) {
    sheet.getRange(row + 1, col, numRows - 1, numCols).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }
}

function fmtEmail_(value) {
  return 'S/ ' + (Number(value) || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtSignedEmail_(value) {
  const sign = value < 0 ? '-' : '';
  return sign + fmtEmail_(Math.abs(value));
}

function escEmail_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nombreMesEmail_(date) {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return meses[date.getMonth()];
}

