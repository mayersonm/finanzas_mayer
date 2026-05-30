// ---- RESUMEN DIARIO POR CORREO: CONSTRUCCION ----------------

function construirResumenDiarioEmail_(chatId) {
  const hoy = new Date();
  const fechaKey = Utilities.formatDate(hoy, 'America/Lima', 'yyyy-MM-dd');
  const fechaLarga = Utilities.formatDate(hoy, 'America/Lima', 'dd/MM/yyyy');
  const periodoPago = periodoPagoEmail_(hoy);
  const mesKey = periodoPago.key;
  const nombreMes = periodoPago.label;

  const txs = obtenerTransaccionesEmail_(chatId);
  const txsHoy = filtrarTransaccionesDiaEmail_(txs, fechaKey);
  const txsMes = filtrarTransaccionesPeriodoEmail_(txs, periodoPago);

  const totalesHoy = calcularTotalesEmail_(txsHoy);
  const totalesMes = calcularTotalesEmail_(txsMes);
  const categoriasHoy = agruparGastosPorCategoriaEmail_(txsHoy);
  const presupuestos = obtenerPresupuestosEmail_(chatId, mesKey, txsMes);
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
    'Ciclo de pago ' + data.nombreMes,
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
        return '<tr><td style="padding:8px 8px 8px 0;word-break:break-word">' + escEmail_(capitalizar(c.cat)) + '</td><td width="120" align="right" style="padding:8px 0 8px 8px;white-space:nowrap"><strong>' + fmtEmail_(c.monto) + '</strong></td></tr>';
      }).join('')
    : '<tr><td colspan="2" style="color:#6b7280">Sin gastos por categoria hoy</td></tr>';

  const txRows = data.txsHoy.length
    ? data.txsHoy.map(function (r) {
        const tipo = String(r[2]);
        const color = tipo === 'ingreso' ? '#16a34a' : '#dc2626';
        const signo = tipo === 'ingreso' ? '+' : '-';
        return [
          '<tr>',
          '<td style="padding:9px 8px 9px 0;word-break:break-word"><strong>' + escEmail_(r[3]) + '</strong><br><span style="color:#6b7280">' + escEmail_(r[4]) + '</span></td>',
          '<td width="130" align="right" style="padding:9px 0 9px 8px;color:' + color + ';white-space:nowrap"><strong>' + signo + ' ' + fmtEmail_(parseFloat(r[5]) || 0) + '</strong></td>',
          '</tr>',
        ].join('');
      }).join('')
    : '<tr><td colspan="2" style="color:#6b7280">No registraste movimientos hoy.</td></tr>';

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

  const metasHtml = data.metas.length
    ? data.metas.map(function (m) {
        const pct = m.objetivo > 0 ? Math.min(Math.round((m.ahorrado / m.objetivo) * 100), 100) : 0;
        return bloqueAvanceEmail_(
          capitalizar(m.nombre),
          fmtEmail_(m.ahorrado) + ' / ' + fmtEmail_(m.objetivo),
          pct,
          '#2563eb',
          pct + '% completado'
        );
      }).join('')
    : '<p style="color:#6b7280;margin:0">Sin metas registradas.</p>';

  return [
    '<div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827">',
    '<div style="max-width:680px;width:100%;margin:0 auto;padding:16px;box-sizing:border-box">',
    '<div style="background:#111827;color:#f9fafb;border-radius:10px;padding:18px;margin-bottom:14px">',
    '<div style="font-size:12px;text-transform:uppercase;color:#9ca3af">Resumen financiero diario</div>',
    '<h1 style="margin:6px 0 0;font-size:24px">' + escEmail_(data.fechaLarga) + '</h1>',
    '</div>',
    cardsEmail_([
      ['Ingresos hoy', fmtEmail_(data.totalesHoy.ingresos), '#16a34a'],
      ['Gastos hoy', fmtEmail_(data.totalesHoy.gastos), '#dc2626'],
      ['Balance hoy', fmtSignedEmail_(balanceHoy), colorBalanceHoy],
    ]),
    seccionEmail_('Movimientos de hoy', '<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse">' + txRows + '</table>'),
    seccionEmail_('Gastos por categoria', '<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse">' + categoriasRows + '</table>'),
    '<div style="font-size:13px;color:#6b7280;margin:2px 0 10px;line-height:1.4">Ciclo de pago: <strong style="color:#111827">' + escEmail_(data.nombreMes) + '</strong></div>',
    cardsEmail_([
      ['Ingresos del ciclo', fmtEmail_(data.totalesMes.ingresos), '#16a34a'],
      ['Gastos del ciclo', fmtEmail_(data.totalesMes.gastos), '#dc2626'],
      ['Balance del ciclo', fmtSignedEmail_(balanceMes), colorBalanceMes],
    ]),
    seccionEmail_('Presupuestos', presupuestosHtml),
    seccionEmail_('Metas', metasHtml),
    '<p style="font-size:12px;color:#6b7280;text-align:center;margin-top:18px">Enviado automaticamente por tu bot de finanzas.</p>',
    '</div>',
    '</div>',
  ].join('');
}

function cardEmail_(label, value, color) {
  return [
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px">',
    '<tr><td style="padding:14px 16px">',
    '<div style="font-size:11px;line-height:1.35;text-transform:uppercase;color:#6b7280;word-break:break-word">' + escEmail_(label) + '</div>',
    '<div style="font-size:21px;line-height:1.25;font-weight:700;color:' + color + ';margin-top:6px;word-break:break-word">' + escEmail_(value) + '</div>',
    '</td></tr>',
    '</table>',
  ].join('');
}

function seccionEmail_(title, content) {
  return [
    '<div style="background:#ffffff;border-radius:10px;padding:16px;border:1px solid #e5e7eb;margin-bottom:14px">',
    '<h2 style="font-size:16px;margin:0 0 12px">' + escEmail_(title) + '</h2>',
    content,
    '</div>',
  ].join('');
}

function cardsEmail_(items) {
  const rows = items.map(function (item) {
    return [
      '<tr><td style="padding:0 0 10px 0">',
      cardEmail_(item[0], item[1], item[2]),
      '</td></tr>',
    ].join('');
  }).join('');

  return '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 4px">' + rows + '</table>';
}

function bloqueAvanceEmail_(label, value, pct, color, caption) {
  const safePct = Math.max(0, Math.min(Math.round(Number(pct) || 0), 100));

  return [
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:10px 0 14px">',
    '<tr>',
    '<td style="font-size:13px;font-weight:700;color:#111827;padding:0 0 3px 0;word-break:break-word">' + escEmail_(label) + '</td>',
    '</tr>',
    '<tr>',
    '<td style="font-size:13px;color:#111827;padding:0 0 8px 0;word-break:break-word">' + escEmail_(value) + '</td>',
    '</tr>',
    '<tr><td style="padding:0">',
    '<div style="height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden">',
    '<div style="width:' + safePct + '%;height:8px;background:' + color + ';border-radius:999px"></div>',
    '</div>',
    '</td></tr>',
    '<tr><td style="font-size:12px;color:' + color + ';padding-top:4px">' + escEmail_(caption) + '</td></tr>',
    '</table>',
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
    const cat = normalizarCat(r[4] || 'otro', r[3], r[6]);
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

function obtenerTransaccionesEmail_(chatId) {
  const d1Txs = leerTransaccionesD1_(chatId, 500);
  if (d1Txs !== null) {
    const rows = d1Txs.map(function (tx) {
      return txD1ToEmailRow_(tx, chatId);
    }).concat(fijosPagadosVirtualesEmail_(chatId));

    return rows.sort(function (a, b) {
      return fechaKeyFilaEmail_(a[0]).localeCompare(fechaKeyFilaEmail_(b[0])) ||
        horaKeyFilaEmail_(a[1]).localeCompare(horaKeyFilaEmail_(b[1]));
    });
  }

  return obtenerTransacciones(chatId);
}

function txD1ToEmailRow_(tx, chatId) {
  return [
    fechaLocalEmail_(tx.fecha),
    horaLocalEmail_(tx.hora),
    String(tx.tipo || 'gasto'),
    String(tx.desc || ''),
    normalizarCat(tx.cat || 'otro', tx.desc || '', chatId),
    Number(tx.monto || 0),
    String(chatId),
    tx.paymentMethod || tx.payment_method || 'debito',
    tx.paymentDueDate || tx.payment_due_date || '',
    tx.cardName || tx.card_name || '',
    tx.currency || 'PEN',
  ];
}

function fijosPagadosVirtualesEmail_(chatId) {
  const d1 = leerDashboardD1_(chatId);
  if (!d1 || !d1.ok || !d1.fijos) return [];

  return d1.fijos
    .filter(function (item) {
      return item.estado === 'pagado' && item.pagadoManual === true && item.pagadoPorTransaccion !== true && item.paidDate;
    })
    .map(function (item) {
      return [
        fechaLocalEmail_(item.paidDate),
        horaLocalEmail_('00:00'),
        'gasto',
        'Fijo pagado: ' + String(item.nombre || ''),
        normalizarCat(item.cat || 'servicios', item.nombre || '', chatId),
        Number(item.montoPen || item.monto || 0),
        String(chatId),
        'debito',
        '',
        '',
        'PEN',
      ];
    });
}

function obtenerPresupuestosEmail_(chatId, mesKey, txsPeriodo) {
  const d1 = leerDashboardD1_(chatId);
  if (d1 && d1.ok && d1.presupuestos) {
    const gastos = gastosPorCategoriaDesdeTxsEmail_(txsPeriodo || []);

    return d1.presupuestos
      .map(function (p) {
        const cat = normalizarCat(p.cat || 'otro', '', chatId);
        return {
          cat: cat,
          limite: Number(p.limite || 0),
          gasto: gastoPresupuestoEmail_(gastos, cat, d1.budgetRules || [], chatId),
        };
      })
      .filter(function (p) {
        return p.limite > 0;
      });
  }

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
        gasto: gastoPresupuestoPorCategoria_(gastos, cat, chatId),
      };
    })
    .filter(function (p) {
      return p.limite > 0;
    });
}

function obtenerMetasEmail_(chatId) {
  const d1 = leerDashboardD1_(chatId);
  if (d1 && d1.ok && d1.metas) {
    return d1.metas.map(function (m) {
      return {
        nombre: String(m.nombre || ''),
        objetivo: Number(m.objetivo || 0),
        ahorrado: Number(m.ahorrado || 0),
      };
    }).filter(function (m) {
      return m.nombre && m.objetivo > 0;
    });
  }

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

function gastosPorCategoriaDesdeTxsEmail_(txs) {
  const map = {};
  (txs || []).forEach(function (r) {
    if (r[2] !== 'gasto') return;
    const cat = normalizarCat(r[4] || 'otro', r[3], r[6]);
    map[cat] = (map[cat] || 0) + (parseFloat(r[5]) || 0);
  });
  return map;
}

function gastoPresupuestoEmail_(gastos, cat, budgetRules, chatId) {
  const base = normalizarCat(cat || 'otro', '', chatId);
  const keys = [base];

  (budgetRules || []).forEach(function (rule) {
    const budgetCat = normalizarCat(rule.budgetCategory || rule.budget_category || '', '', chatId);
    const includedCat = normalizarCat(rule.includedCategory || rule.included_category || '', '', chatId);
    if (budgetCat === base && includedCat && keys.indexOf(includedCat) < 0) keys.push(includedCat);
  });

  return keys.reduce(function (total, key) {
    return total + Number(gastos[key] || 0);
  }, 0);
}

function filtrarTransaccionesDiaEmail_(txs, fechaKey) {
  return (txs || []).filter(function (r) {
    return fechaKeyFilaEmail_(r[0]) === fechaKey;
  });
}

function filtrarTransaccionesPeriodoEmail_(txs, periodo) {
  const p = normalizarPeriodoPagoEmail_(periodo);
  return (txs || []).filter(function (r) {
    const key = fechaKeyFilaEmail_(r[0]);
    return key >= p.startKey && key <= p.endKey;
  });
}

function periodoPagoEmail_(date) {
  const base = fechaLocalEmail_(Utilities.formatDate(date || new Date(), 'America/Lima', 'yyyy-MM-dd'));
  const start = base.getDate() >= 23
    ? new Date(base.getFullYear(), base.getMonth(), 23)
    : new Date(base.getFullYear(), base.getMonth() - 1, 23);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 22);
  const close = new Date(start.getFullYear(), start.getMonth() + 1, 23);
  const startKey = Utilities.formatDate(start, 'America/Lima', 'yyyy-MM-dd');
  const endKey = Utilities.formatDate(end, 'America/Lima', 'yyyy-MM-dd');
  const closeKey = Utilities.formatDate(close, 'America/Lima', 'yyyy-MM-dd');

  return {
    start: start,
    end: end,
    close: close,
    startKey: startKey,
    endKey: endKey,
    closeKey: closeKey,
    key: Utilities.formatDate(start, 'America/Lima', 'yyyy-MM'),
    label: 'Cierre ' + Utilities.formatDate(close, 'America/Lima', 'dd/MM/yyyy'),
    rangeLabel: Utilities.formatDate(start, 'America/Lima', 'dd/MM/yyyy') + ' - ' + Utilities.formatDate(end, 'America/Lima', 'dd/MM/yyyy'),
  };
}

function periodoPagoCerradoEmail_(date) {
  const base = fechaLocalEmail_(Utilities.formatDate(date || new Date(), 'America/Lima', 'yyyy-MM-dd'));
  base.setDate(base.getDate() - 1);
  return periodoPagoEmail_(base);
}

function periodoPagoRelativoEmail_(periodo, offset) {
  const p = normalizarPeriodoPagoEmail_(periodo);
  return periodoPagoEmail_(new Date(p.start.getFullYear(), p.start.getMonth() + offset, p.start.getDate()));
}

function normalizarPeriodoPagoEmail_(periodo) {
  if (periodo && periodo.start && periodo.end) return periodo;
  return periodoPagoEmail_(periodo || new Date());
}

function fechaLocalEmail_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = String(value || '').slice(0, 10);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return new Date();
}

function horaLocalEmail_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return new Date(2000, 0, 1, value.getHours(), value.getMinutes());
  }

  const match = String(value || '00:00').match(/^(\d{1,2}):(\d{2})/);
  return new Date(2000, 0, 1, match ? Number(match[1]) : 0, match ? Number(match[2]) : 0);
}

function fechaKeyFilaEmail_(value) {
  return Utilities.formatDate(fechaLocalEmail_(value), 'America/Lima', 'yyyy-MM-dd');
}

function horaKeyFilaEmail_(value) {
  return Utilities.formatDate(horaLocalEmail_(value), 'America/Lima', 'HH:mm');
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
        Utilities.formatDate(fechaLocalEmail_(r[0]), 'America/Lima', 'yyyy-MM-dd'),
        Utilities.formatDate(horaLocalEmail_(r[1]), 'America/Lima', 'HH:mm'),
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

