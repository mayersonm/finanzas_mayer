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
        return '<tr>' +
          celdaEmail_(escEmail_(capitalizar(c.cat)), 'left', false) +
          celdaEmail_(fmtEmail_(c.monto), 'right', true) +
          '</tr>';
      }).join('')
    : '<tr><td colspan="2" style="padding:12px 8px;color:#64748b">Sin gastos por categoria hoy</td></tr>';

  const txRows = data.txsHoy.length
    ? data.txsHoy.map(function (r) {
        const tipo = String(r[2]);
        const color = tipo === 'ingreso' ? '#16a34a' : '#dc2626';
        const signo = tipo === 'ingreso' ? '+' : '-';
        const detalle = '<strong>' + escEmail_(r[3]) + '</strong><br><span style="color:#64748b">' + escEmail_(r[4]) + '</span>';
        return [
          '<tr>',
          celdaEmail_(detalle, 'left', false),
          celdaEmail_(signo + ' ' + fmtEmail_(parseFloat(r[5]) || 0), 'right', true, color),
          '</tr>',
        ].join('');
      }).join('')
    : '<tr><td colspan="2" style="padding:12px 8px;color:#64748b">No registraste movimientos hoy.</td></tr>';

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

  return emailShell_([
    emailHero_('Resumen financiero diario', data.fechaLarga, 'Movimientos, presupuesto y avance del ciclo en una sola lectura.', data.nombreMes),
    cardsEmail_([
      ['Ingresos hoy', fmtEmail_(data.totalesHoy.ingresos), '#16a34a'],
      ['Gastos hoy', fmtEmail_(data.totalesHoy.gastos), '#dc2626'],
      ['Balance hoy', fmtSignedEmail_(balanceHoy), colorBalanceHoy],
    ]),
    seccionEmail_('Movimientos de hoy', tablaEmail_(txRows)),
    seccionEmail_('Gastos por categoria', tablaEmail_(categoriasRows)),
    '<div style="font-size:13px;color:#6b7280;margin:2px 0 10px;line-height:1.4">Ciclo de pago: <strong style="color:#111827">' + escEmail_(data.nombreMes) + '</strong></div>',
    cardsEmail_([
      ['Ingresos del ciclo', fmtEmail_(data.totalesMes.ingresos), '#16a34a'],
      ['Gastos del ciclo', fmtEmail_(data.totalesMes.gastos), '#dc2626'],
      ['Balance del ciclo', fmtSignedEmail_(balanceMes), colorBalanceMes],
    ]),
    seccionEmail_('Presupuestos', presupuestosHtml),
    seccionEmail_('Metas', metasHtml),
    footerEmail_('Enviado automaticamente por tu bot de finanzas. El Excel adjunto queda como respaldo.'),
  ].join(''), 680);
}

function cardEmail_(label, value, color) {
  return [
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dbe3ef;border-radius:14px;box-shadow:0 8px 22px rgba(15,23,42,0.06)">',
    '<tr><td style="padding:15px 16px">',
    '<div style="font-size:10px;line-height:1.35;text-transform:uppercase;letter-spacing:.4px;color:#64748b;word-break:break-word">' + escEmail_(label) + '</div>',
    '<div style="font-size:22px;line-height:1.2;font-weight:800;color:' + color + ';margin-top:7px;word-break:break-word">' + escEmail_(value) + '</div>',
    '<div style="width:34px;height:3px;background:' + color + ';border-radius:999px;margin-top:10px"></div>',
    '</td></tr>',
    '</table>',
  ].join('');
}

function seccionEmail_(title, content) {
  return [
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dbe3ef;border-radius:16px;margin:0 0 14px;box-shadow:0 10px 24px rgba(15,23,42,0.05)">',
    '<tr><td style="padding:17px 18px">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:12px">',
    '<tr>',
    '<td style="font-size:16px;line-height:1.35;font-weight:800;color:#0f172a">' + escEmail_(title) + '</td>',
    '<td width="34" align="right"><div style="width:28px;height:4px;background:#10b981;border-radius:999px"></div></td>',
    '</tr>',
    '</table>',
    '<div style="font-size:13px;line-height:1.5;color:#111827;overflow-x:auto">' + content + '</div>',
    '</td></tr>',
    '</table>',
  ].join('');
}

function cardsEmail_(items) {
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    const first = items[i];
    const second = items[i + 1];
    rows.push([
      '<tr>',
      '<td width="50%" valign="top" style="padding:0 6px 12px 0">',
      cardEmail_(first[0], first[1], first[2]),
      '</td>',
      '<td width="50%" valign="top" style="padding:0 0 12px 6px">',
      second ? cardEmail_(second[0], second[1], second[2]) : '&nbsp;',
      '</td>',
      '</tr>',
    ].join(''));
  }

  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 4px">' + rows.join('') + '</table>';
}

function emailShell_(content, maxWidth) {
  return [
    '<div style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#111827">',
    '<div style="display:none;max-height:0;overflow:hidden;color:#eef2f7;opacity:0">Resumen financiero de Finanzas Mayeson</div>',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#eef2f7">',
    '<tr><td align="center" style="padding:18px 10px">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:' + (maxWidth || 720) + 'px;border-collapse:collapse">',
    '<tr><td>',
    content,
    '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</div>',
  ].join('');
}

function emailHero_(eyebrow, title, subtitle, chip) {
  return [
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#0f172a;color:#f8fafc;border-radius:18px;margin:0 0 14px;box-shadow:0 14px 30px rgba(15,23,42,0.18)">',
    '<tr><td style="padding:24px 22px;border-left:5px solid #10b981;border-radius:18px">',
    '<div style="font-size:11px;line-height:1.4;text-transform:uppercase;letter-spacing:.7px;color:#94a3b8;font-weight:700">' + escEmail_(eyebrow) + '</div>',
    '<div style="font-size:27px;line-height:1.15;font-weight:800;margin-top:7px;color:#ffffff">' + escEmail_(title) + '</div>',
    subtitle ? '<div style="font-size:13px;line-height:1.55;color:#cbd5e1;margin-top:9px">' + escEmail_(subtitle) + '</div>' : '',
    chip ? '<div style="display:inline-block;margin-top:14px;padding:6px 10px;border-radius:999px;background:#064e3b;color:#d1fae5;font-size:12px;font-weight:700">' + escEmail_(chip) + '</div>' : '',
    '</td></tr>',
    '</table>',
  ].join('');
}

function footerEmail_(text) {
  return [
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:4px">',
    '<tr><td align="center" style="font-size:12px;line-height:1.5;color:#64748b;padding:8px 12px 2px">',
    escEmail_(text || 'Generado por Finanzas Mayeson.'),
    '</td></tr>',
    '</table>',
  ].join('');
}

function tablaEmail_(innerHtml) {
  return [
    '<div style="width:100%;overflow-x:auto">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;line-height:1.45">',
    innerHtml,
    '</table>',
    '</div>',
  ].join('');
}

function celdaEmail_(content, align, strong, color) {
  const textAlign = align || 'left';
  const value = strong ? '<strong>' + content + '</strong>' : content;
  return '<td align="' + textAlign + '" style="padding:10px 8px;border-bottom:1px solid #edf2f7;color:' + (color || '#111827') + ';vertical-align:top;word-break:break-word">' + value + '</td>';
}

function thEmail_(content, align) {
  return '<th align="' + (align || 'left') + '" style="padding:10px 8px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:12px;text-transform:uppercase;letter-spacing:.35px">' + escEmail_(content) + '</th>';
}

function captionEmail_(label, value) {
    return [
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0">',
      '<tr>',
      '<td style="padding:4px 0;color:#64748b;font-size:13px">' + escEmail_(label) + '</td>',
      '<td align="right" style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:700">' + escEmail_(value) + '</td>',
      '</tr>',
      '</table>',
    ].join('');
}

function bloqueAvanceEmail_(label, value, pct, color, caption) {
  const safePct = Math.max(0, Math.min(Math.round(Number(pct) || 0), 100));

  return [
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 16px">',
    '<tr>',
    '<td style="font-size:13px;font-weight:800;color:#0f172a;padding:0 10px 7px 0;word-break:break-word">' + escEmail_(label) + '</td>',
    '<td align="right" style="font-size:13px;color:#0f172a;font-weight:700;padding:0 0 7px 10px;white-space:nowrap">' + escEmail_(value) + '</td>',
    '</tr>',
    '<tr><td style="padding:0">',
    '<div style="height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden">',
    '<div style="width:' + safePct + '%;height:8px;background:' + color + ';border-radius:999px"></div>',
    '</div>',
    '</td><td width="72" align="right" style="font-size:12px;color:' + color + ';padding-left:10px;font-weight:700">' + escEmail_(caption) + '</td></tr>',
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
  const start = base.getDate() > 22
    ? new Date(base.getFullYear(), base.getMonth(), 22)
    : new Date(base.getFullYear(), base.getMonth() - 1, 22);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 22);
  const close = end;
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
    label: nombreMesEmail_(start),
    shortLabel: nombreMesCortoEmail_(start),
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

function nombreMesCortoEmail_(date) {
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return meses[date.getMonth()];
}

