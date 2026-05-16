// ============================================================
// 09_API.gs - API JSON para el dashboard web
// ============================================================
//
// Este archivo NO define doGet(e), para no chocar con el webhook actual.
// En 01_Webhook.js solo agrega este ruteo dentro de doGet:
//
// function doGet(e) {
//   if (e && e.parameter && e.parameter.action) return handleDashboardApi(e);
//   return ContentService.createTextOutput('BOT ACTIVO');
// }
//
// Script Properties recomendadas:
//   dashboard_api_key = clave para el dashboard
//   dashboard_chat_id = tu ChatID de Telegram (opcional, recomendado)
//
// Usa las hojas actuales:
//   Transacciones: Fecha | Hora | Tipo | Descripcion | Categoria | Monto | ChatID
//   Presupuestos : ChatID | Categoria | Limite
//   Metas        : ChatID | Nombre | Objetivo | Ahorrado | Creada
//   Deudas       : ChatID | Nombre | Total | Pagado | Vencimiento | Estado | Notas

const DASH_TZ = 'America/Lima';

const DASH_COLORS = {
  comida: '#22c55e',
  supermercado: '#84cc16',
  transporte: '#3b82f6',
  servicios: '#f59e0b',
  entretenimiento: '#ec4899',
  salud: '#8b5cf6',
  ropa: '#14b8a6',
  educacion: '#f97316',
  salario: '#06b6d4',
  freelance: '#a855f7',
  otro: '#6b7280',
};

function handleDashboardApi(e) {
  const params = (e && e.parameter) || {};

  if (!dashIsAuthorized_(params.key)) {
    return dashJson_({
      ok: false,
      error: 'Unauthorized',
    });
  }

  const action = String(params.action || 'dashboard').toLowerCase();

  try {
    if (action === 'health' || action === 'ping') {
      return dashJson_(dashHealth_());
    }

    if (action === 'dashboard') {
      return dashJson_(dashDashboardData_(params));
    }

    if (action === 'txs' || action === 'transacciones') {
      return dashJson_(dashTransactions_(params));
    }

    if (action === 'delete_tx' || action === 'eliminar_tx') {
      return dashJson_(dashDeleteTransaction_(params));
    }

    if (action === 'stats') {
      return dashJson_(dashStats_(params));
    }

    if (action === 'config') {
      return dashJson_(dashConfig_());
    }

    if (action === 'update_config') {
      return dashJson_(dashUpdateConfig_(params));
    }

    return dashJson_({
      ok: false,
      error: 'Accion no valida',
      validActions: ['health', 'dashboard', 'txs', 'delete_tx', 'stats', 'config', 'update_config'],
    });
  } catch (err) {
    Logger.log('Dashboard API error: ' + (err && err.stack ? err.stack : err));
    return dashJson_({
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
}

function dashDashboardData_(params) {
  const now = new Date();
  const monthKey = Utilities.formatDate(now, DASH_TZ, 'yyyy-MM');
  const allTxs = dashReadTransactions_(params);
  const monthTxs = allTxs.filter(function (tx) {
    return tx.fecha.indexOf(monthKey) === 0;
  });

  const ingresos = dashSum_(allTxs, 'ingreso');
  const gastos = dashSum_(allTxs, 'gasto');
  const ingresosMes = dashSum_(monthTxs, 'ingreso');
  const gastosMes = dashSum_(monthTxs, 'gasto');
  const categorias = dashCategories_(monthTxs);
  const presupuestos = dashReadBudgets_(params, categorias);
  const fijos = dashReadFixedExpenses_(params, monthTxs, monthKey);
  const deudas = dashReadDebts_(params);
  const meses = dashLastMonths_(allTxs, now);
  const alertas = dashSmartAlerts_(allTxs, presupuestos, fijos, deudas, monthKey);
  const insights = dashSmartInsights_(monthTxs, categorias, presupuestos, deudas, meses);

  return {
    ok: true,
    balance: dashRound_(ingresos - gastos),
    ingresos: dashRound_(ingresos),
    gastos: dashRound_(gastos),
    ingresosMes: dashRound_(ingresosMes),
    gastosMes: dashRound_(gastosMes),
    balanceMes: dashRound_(ingresosMes - gastosMes),
    movimientos: allTxs.length,
    mes: dashMonthName_(now),
    mesKey: monthKey,
    transacciones: allTxs.slice(-20).reverse(),
    categorias: categorias,
    meses: meses,
    presupuestos: presupuestos,
    fijos: fijos,
    deudas: deudas,
    gastosReales: dashRealExpenses_(fijos, presupuestos),
    metas: dashReadGoals_(params),
    alertas: alertas,
    insights: insights,
    emailConfig: dashEmailConfig_(),
    updatedAt: Utilities.formatDate(now, DASH_TZ, "yyyy-MM-dd'T'HH:mm:ss"),
  };
}

function dashTransactions_(params) {
  const limit = Math.min(dashInt_(params.limit, 100), 500);
  const txs = dashReadTransactions_(params);

  return {
    ok: true,
    total: txs.length,
    limit: limit,
    transacciones: txs.slice(-limit).reverse(),
  };
}

function dashStats_(params) {
  const month = /^\d{4}-\d{2}$/.test(String(params.mes || ''))
    ? String(params.mes)
    : Utilities.formatDate(new Date(), DASH_TZ, 'yyyy-MM');

  const txs = dashReadTransactions_(params).filter(function (tx) {
    return tx.fecha.indexOf(month) === 0;
  });

  const ingresos = dashSum_(txs, 'ingreso');
  const gastos = dashSum_(txs, 'gasto');

  return {
    ok: true,
    mes: month,
    ingresos: dashRound_(ingresos),
    gastos: dashRound_(gastos),
    balance: dashRound_(ingresos - gastos),
    movimientos: txs.length,
    categorias: dashCategories_(txs),
  };
}

function dashHealth_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const props = PropertiesService.getScriptProperties();

  return {
    ok: true,
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    sheets: {
      transacciones: Boolean(ss.getSheetByName('Transacciones')),
      presupuestos: Boolean(ss.getSheetByName('Presupuestos')),
      metas: Boolean(ss.getSheetByName('Metas')),
      fijos: Boolean(ss.getSheetByName('Fijos')),
      deudas: Boolean(ss.getSheetByName('Deudas')),
      cierresMensuales: Boolean(ss.getSheetByName('CierresMensuales')),
    },
    emailConfig: dashEmailConfig_(),
    services: {
      telegramToken: Boolean(props.getProperty('telegram_bot_token')),
      workerUrl: Boolean(props.getProperty('worker_url')),
      claudeApiKey: Boolean(props.getProperty('claude_api_key')),
      d1ApiUrl: Boolean(props.getProperty('d1_api_url')),
      d1AdminKey: Boolean(props.getProperty('d1_admin_key')),
    },
    checkedAt: Utilities.formatDate(new Date(), DASH_TZ, "yyyy-MM-dd'T'HH:mm:ss"),
  };
}

function dashConfig_() {
  const props = PropertiesService.getScriptProperties();

  return {
    ok: true,
    config: {
      creditCutoffDay: props.getProperty('credit_cutoff_day') || props.getProperty('credito_corte_dia') || '25',
      creditDueDay: props.getProperty('credit_due_day') || props.getProperty('credito_pago_dia') || '10',
      creditCardName: props.getProperty('credit_card_name') || props.getProperty('credito_tarjeta') || '',
      receiptImageMaxBytes: props.getProperty('receipt_image_max_bytes') || '921600',
      claudeModel: props.getProperty('claude_model') || 'claude-haiku-4-5-20251001',
      claudeApiUrl: dashMaskUrl_(props.getProperty('claude_api_url') || 'https://api.synterolink.com/v1/messages'),
      financeEmailTo: props.getProperty('finance_email_to') || '',
      dailyEmailTo: props.getProperty('daily_email_to') || props.getProperty('finance_email_to') || '',
      monthlyEmailTo: props.getProperty('monthly_email_to') || props.getProperty('finance_email_to') || '',
      yearlyEmailTo: props.getProperty('yearly_email_to') || props.getProperty('finance_email_to') || '',
    },
    secrets: {
      telegramBotToken: Boolean(props.getProperty('telegram_bot_token')),
      dashboardApiKey: Boolean(props.getProperty('dashboard_api_key')),
      claudeApiKey: Boolean(props.getProperty('claude_api_key')),
      d1AdminKey: Boolean(props.getProperty('d1_admin_key')),
      d1ApiUrl: Boolean(props.getProperty('d1_api_url')),
      workerUrl: Boolean(props.getProperty('worker_url')),
    },
    updatedAt: Utilities.formatDate(new Date(), DASH_TZ, "yyyy-MM-dd'T'HH:mm:ss"),
  };
}

function dashUpdateConfig_(params) {
  const props = PropertiesService.getScriptProperties();
  const updates = {};

  dashSetIntProp_(updates, 'credit_cutoff_day', params.creditCutoffDay, 1, 31);
  dashSetIntProp_(updates, 'credit_due_day', params.creditDueDay, 1, 31);
  dashSetIntProp_(updates, 'receipt_image_max_bytes', params.receiptImageMaxBytes, 200000, 3000000);
  dashSetTextProp_(updates, 'credit_card_name', params.creditCardName, 80);
  dashSetTextProp_(updates, 'claude_model', params.claudeModel, 120);
  dashSetEmailProp_(updates, 'finance_email_to', params.financeEmailTo);
  dashSetEmailProp_(updates, 'daily_email_to', params.dailyEmailTo);
  dashSetEmailProp_(updates, 'monthly_email_to', params.monthlyEmailTo);
  dashSetEmailProp_(updates, 'yearly_email_to', params.yearlyEmailTo);

  Object.keys(updates).forEach(function (key) {
    props.setProperty(key, updates[key]);
  });

  return {
    ok: true,
    saved: Object.keys(updates),
    config: dashConfig_().config,
  };
}

function dashReadTransactions_(params) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Transacciones');
  if (!sheet || sheet.getLastRow() < 2) return [];

  const chatId = dashDashboardChatId_(params);
  const rows = sheet.getDataRange().getValues().slice(1);

  return rows
    .filter(function (row) {
      return !chatId || String(row[6]).trim() === chatId;
    })
    .map(function (row, index) {
      const fecha = dashDate_(row[0], 'yyyy-MM-dd');
      if (!fecha) return null;

      const desc = String(row[3] || 'Sin descripcion');

      return {
        id: String(index + 2),
        fecha: fecha,
        hora: dashDate_(row[1], 'HH:mm') || '00:00',
        tipo: String(row[2] || '').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto',
        desc: desc,
        cat: normalizarCat(row[4] || 'otro', desc, chatId),
        monto: dashRound_(Math.abs(parseFloat(row[5]) || 0)),
        currency: normalizarMoneda_(row[10]) || 'PEN',
        paymentMethod: dashPaymentMethod_(row[7]),
        paymentDueDate: dashPlainDate_(row[8]),
        cardName: String(row[9] || ''),
      };
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return (a.fecha + ' ' + a.hora).localeCompare(b.fecha + ' ' + b.hora);
    });
}

function dashReadBudgets_(params, categorias) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Presupuestos');
  if (!sheet || sheet.getLastRow() < 2) return [];

  const chatId = dashDashboardChatId_(params);
  const spending = {};

  categorias.forEach(function (item) {
    spending[String(item.cat).toLowerCase()] = item.monto;
  });

  return sheet.getDataRange().getValues().slice(1)
    .filter(function (row) {
      return !chatId || String(row[0]).trim() === chatId;
    })
    .map(function (row) {
      const cat = String(row[1] || 'otro');
      const limit = parseFloat(row[2]) || 0;
      if (limit <= 0) return null;

      return {
        cat: dashTitle_(cat),
        limite: dashRound_(limit),
        gasto: dashRound_(gastoPresupuestoPorCategoria_(spending, cat, chatId)),
      };
    })
    .filter(Boolean);
}

function dashReadGoals_(params) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Metas');
  if (!sheet || sheet.getLastRow() < 2) return [];

  const chatId = dashDashboardChatId_(params);

  return sheet.getDataRange().getValues().slice(1)
    .filter(function (row) {
      return !chatId || String(row[0]).trim() === chatId;
    })
    .map(function (row) {
      const objetivo = parseFloat(row[2]) || 0;
      if (objetivo <= 0) return null;

      return {
        nombre: dashTitle_(row[1]),
        objetivo: dashRound_(objetivo),
        ahorrado: dashRound_(parseFloat(row[3]) || 0),
      };
    })
    .filter(Boolean);
}

function dashReadFixedExpenses_(params, monthTxs, monthKey) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Fijos');
  if (!sheet || sheet.getLastRow() < 2) return [];

  const chatId = dashDashboardChatId_(params);
  const cache = CacheService.getScriptCache();

  return sheet.getDataRange().getValues().slice(1)
    .filter(function (row) {
      return !chatId || String(row[0]).trim() === chatId;
    })
    .map(function (row) {
      const nombre = String(row[1] || '').trim();
      const monto = parseFloat(row[2]) || 0;
      const cat = String(row[3] || 'servicios').toLowerCase();
      if (!nombre || monto <= 0) return null;

      const paid = monthTxs.some(function (tx) {
        return tx.tipo === 'gasto' &&
          String(tx.desc || '').toLowerCase() === dashTitle_(nombre).toLowerCase();
      });
      const skipped = Boolean(chatId && cache.get('skip_fijo_' + chatId + '_' + nombre.toLowerCase() + '_' + monthKey));

      return {
        nombre: dashTitle_(nombre),
        monto: dashRound_(monto),
        cat: dashTitle_(cat),
        color: DASH_COLORS[cat] || DASH_COLORS.otro,
        pagadoMes: paid,
        saltadoMes: skipped,
        estado: paid ? 'pagado' : skipped ? 'saltado' : 'pendiente',
      };
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return b.monto - a.monto;
    });
}

function dashDeleteTransaction_(params) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Transacciones');
  if (!sheet || sheet.getLastRow() < 2) {
    return { ok: false, error: 'No hay transacciones para eliminar' };
  }

  const chatId = dashDashboardChatId_(params);
  const numericId = parseInt(params.id || params.row || '', 10);

  if (!isNaN(numericId) && numericId >= 2 && numericId <= sheet.getLastRow()) {
    const row = sheet.getRange(numericId, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!chatId || String(row[6]).trim() === chatId) {
      sheet.deleteRow(numericId);
      return { ok: true, deleted: true, rowNumber: numericId };
    }
  }

  const values = sheet.getDataRange().getValues();
  const target = {
    fecha: String(params.fecha || '').slice(0, 10),
    hora: String(params.hora || '00:00').slice(0, 5),
    tipo: String(params.tipo || 'gasto').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto',
    desc: String(params.desc || ''),
    cat: String(params.cat || 'otro').toLowerCase(),
    monto: parseFloat(params.monto || params.amount || 0) || 0,
  };

  for (let i = values.length - 1; i >= 1; i--) {
    const row = values[i];
    const rowChat = String(row[6]).trim();
    if (chatId && rowChat !== chatId) continue;

    const rowFecha = dashDate_(row[0], 'yyyy-MM-dd');
    const rowHora = dashDate_(row[1], 'HH:mm') || '00:00';
    const rowTipo = String(row[2] || 'gasto').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
    const rowDesc = String(row[3] || '');
    const rowCat = String(row[4] || 'otro').toLowerCase();
    const rowMonto = parseFloat(row[5]) || 0;

    if (
      rowFecha === target.fecha &&
      rowHora === target.hora &&
      rowTipo === target.tipo &&
      rowDesc === target.desc &&
      rowCat === target.cat &&
      Math.abs(rowMonto - target.monto) < 0.005
    ) {
      sheet.deleteRow(i + 1);
      return { ok: true, deleted: true, rowNumber: i + 1 };
    }
  }

  return { ok: false, error: 'Transaccion no encontrada en Sheets' };
}

function dashReadDebts_(params) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Deudas');
  if (!sheet || sheet.getLastRow() < 2) return [];

  const chatId = dashDashboardChatId_(params);

  return sheet.getDataRange().getValues().slice(1)
    .filter(function (row) {
      return !chatId || String(row[0]).trim() === chatId;
    })
    .map(function (row) {
      const total = parseFloat(row[2]) || 0;
      const pagado = parseFloat(row[3]) || 0;
      if (!row[1] || total <= 0) return null;

      const pendiente = Math.max(total - pagado, 0);
      return {
        nombre: dashTitle_(row[1]),
        total: dashRound_(total),
        pagado: dashRound_(pagado),
        pendiente: dashRound_(pendiente),
        vencimiento: dashPlainDate_(row[4]),
        estado: String(row[5] || (pendiente > 0 ? 'activa' : 'pagada')).toLowerCase(),
        notas: String(row[6] || ''),
      };
    })
    .filter(Boolean)
    .sort(function (a, b) {
      if (a.estado !== b.estado) return a.estado === 'activa' ? -1 : 1;
      return b.pendiente - a.pendiente;
    });
}

function dashRealExpenses_(fijos, presupuestos) {
  const totalFijos = fijos.reduce(function (total, item) {
    return total + item.monto;
  }, 0);

  const totalPresupuesto = presupuestos.reduce(function (total, item) {
    const gasto = Number(item.gasto) || 0;
    const limite = Number(item.limite) || 0;
    return total + (gasto > 0 ? gasto : limite);
  }, 0);

  return {
    totalFijos: dashRound_(totalFijos),
    totalPresupuesto: dashRound_(totalPresupuesto),
    total: dashRound_(totalFijos + totalPresupuesto),
    regla: 'budget_spent_or_limit',
  };
}

function dashEmailConfig_() {
  const props = PropertiesService.getScriptProperties();
  const base = props.getProperty('finance_email_to') || '';
  const daily = props.getProperty('daily_email_to') || base;
  const monthly = props.getProperty('monthly_email_to') || daily;
  const yearly = props.getProperty('yearly_email_to') || monthly;

  return {
    configured: Boolean(daily || monthly || yearly),
    daily: dashMaskEmail_(daily),
    monthly: dashMaskEmail_(monthly),
    yearly: dashMaskEmail_(yearly),
  };
}

function dashCategories_(txs) {
  const map = {};

  txs.forEach(function (tx) {
    if (tx.tipo !== 'gasto') return;
    map[tx.cat] = (map[tx.cat] || 0) + tx.monto;
  });

  return Object.keys(map)
    .sort(function (a, b) {
      return map[b] - map[a];
    })
    .map(function (cat) {
      return {
        cat: dashTitle_(cat),
        monto: dashRound_(map[cat]),
        color: DASH_COLORS[cat] || DASH_COLORS.otro,
      };
    });
}

function dashLastMonths_(txs, now) {
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const months = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = Utilities.formatDate(date, DASH_TZ, 'yyyy-MM');
    const monthTxs = txs.filter(function (tx) {
      return tx.fecha.indexOf(key) === 0;
    });

    months.push({
      mes: names[date.getMonth()],
      key: key,
      ingresos: dashRound_(dashSum_(monthTxs, 'ingreso')),
      gastos: dashRound_(dashSum_(monthTxs, 'gasto')),
    });
  }

  return months;
}

function dashSmartAlerts_(allTxs, presupuestos, fijos, deudas, monthKey) {
  const hoy = Utilities.formatDate(new Date(), DASH_TZ, 'yyyy-MM-dd');
  const alertas = [];

  presupuestos.forEach(function (item) {
    const pct = item.limite > 0 ? Math.round((item.gasto / item.limite) * 100) : 0;
    if (pct >= 100) {
      alertas.push({ level: 'danger', title: 'Presupuesto superado: ' + item.cat, message: 'Vas en S/ ' + item.gasto.toFixed(2) + ' de S/ ' + item.limite.toFixed(2) + ' (' + pct + '%).' });
    } else if (pct >= 80) {
      alertas.push({ level: 'warning', title: 'Presupuesto cerca del limite: ' + item.cat, message: 'Ya usaste ' + pct + '% del presupuesto.' });
    }
  });

  fijos.filter(function (item) { return item.estado === 'pendiente'; }).slice(0, 3)
    .forEach(function (item) {
      alertas.push({ level: 'info', title: 'Gasto fijo pendiente: ' + item.nombre, message: 'Falta marcar S/ ' + item.monto.toFixed(2) + ' como pagado o saltado.' });
    });

  deudas.filter(function (item) { return item.estado === 'activa' && item.vencimiento; })
    .forEach(function (item) {
      const dias = dashDaysBetween_(hoy, item.vencimiento);
      if (dias < 0) {
        alertas.push({ level: 'danger', title: 'Deuda vencida: ' + item.nombre, message: 'Pendiente S/ ' + item.pendiente.toFixed(2) + ' desde ' + item.vencimiento + '.' });
      } else if (dias <= 7) {
        alertas.push({ level: 'warning', title: 'Deuda por vencer: ' + item.nombre, message: 'Vence en ' + dias + ' dia' + (dias === 1 ? '' : 's') + ' y queda S/ ' + item.pendiente.toFixed(2) + '.' });
      }
    });

  allTxs.filter(function (tx) {
    return tx.tipo === 'gasto' && tx.paymentMethod === 'credito' && tx.paymentDueDate;
  }).slice(-20).forEach(function (tx) {
    const dias = dashDaysBetween_(hoy, tx.paymentDueDate);
    if (dias >= 0 && dias <= 5) {
      alertas.push({ level: 'warning', title: 'Pago de credito cercano', message: tx.desc + ': S/ ' + tx.monto.toFixed(2) + ' vence el ' + tx.paymentDueDate + '.' });
    }
  });

  const monthTxs = allTxs.filter(function (tx) { return tx.fecha.indexOf(monthKey) === 0; });
  const ingresosMes = dashSum_(monthTxs, 'ingreso');
  const gastosMes = dashSum_(monthTxs, 'gasto');
  if (ingresosMes > 0 && gastosMes > ingresosMes) {
    alertas.push({ level: 'danger', title: 'Gastos sobre ingresos', message: 'Este mes gastaste S/ ' + gastosMes.toFixed(2) + ' contra S/ ' + ingresosMes.toFixed(2) + ' de ingresos.' });
  }

  return alertas.slice(0, 8);
}

function dashSmartInsights_(monthTxs, categorias, presupuestos, deudas, meses) {
  const gastosMes = dashSum_(monthTxs, 'gasto');
  const ingresosMes = dashSum_(monthTxs, 'ingreso');
  const insights = [];
  const top = categorias[0];

  if (top && gastosMes > 0) {
    insights.push({
      title: 'Mayor fuga: ' + top.cat,
      message: 'Representa ' + Math.round((top.monto / gastosMes) * 100) + '% del gasto del mes.',
    });
  }

  if (meses.length >= 2 && meses[meses.length - 2].gastos > 0) {
    const prev = meses[meses.length - 2];
    const curr = meses[meses.length - 1];
    const delta = Math.round(((curr.gastos - prev.gastos) / prev.gastos) * 100);
    insights.push({
      title: delta >= 0 ? 'Gasto acelerado' : 'Gasto mas controlado',
      message: 'Vas ' + Math.abs(delta) + '% ' + (delta >= 0 ? 'por encima' : 'por debajo') + ' del mes anterior.',
    });
  }

  const deudaTotal = deudas
    .filter(function (item) { return item.estado === 'activa'; })
    .reduce(function (total, item) { return total + item.pendiente; }, 0);
  if (deudaTotal > 0) {
    insights.push({ title: 'Deuda pendiente', message: 'Tienes S/ ' + deudaTotal.toFixed(2) + ' pendiente. Prioriza lo que vence primero.' });
  }

  if (ingresosMes > 0) {
    const margen = Math.round(((ingresosMes - gastosMes) / ingresosMes) * 100);
    insights.push({
      title: margen >= 20 ? 'Buen margen de ahorro' : 'Margen ajustado',
      message: 'Tu margen del mes es ' + margen + '%.',
    });
  }

  return insights.slice(0, 6);
}

function dashSum_(txs, type) {
  return txs.reduce(function (total, tx) {
    return total + (tx.tipo === type ? tx.monto : 0);
  }, 0);
}

function dashIsAuthorized_(key) {
  const validKey = PropertiesService.getScriptProperties().getProperty('dashboard_api_key');
  return Boolean(validKey && key && String(key) === String(validKey));
}

function dashDashboardChatId_(params) {
  return String(
    params.chat_id ||
    PropertiesService.getScriptProperties().getProperty('dashboard_chat_id') ||
    ''
  ).trim();
}

function dashJson_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function dashDate_(value, format) {
  if (!value) return '';

  const date = Object.prototype.toString.call(value) === '[object Date]'
    ? value
    : new Date(value);

  if (isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, DASH_TZ, format);
}

function dashPlainDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, DASH_TZ, 'yyyy-MM-dd');
  }

  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return dashDate_(value, 'yyyy-MM-dd');
}

function dashPaymentMethod_(value) {
  const method = String(value || '').toLowerCase().trim();
  return method === 'credito' ? 'credito' : 'debito';
}

function dashTitle_(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(function (part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

function dashMonthName_(date) {
  return [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ][date.getMonth()];
}

function dashMaskEmail_(email) {
  const value = String(email || '').trim();
  const parts = value.split('@');
  if (parts.length !== 2) return '';

  const user = parts[0];
  const domain = parts[1];
  const visible = user.length <= 2 ? user.charAt(0) : user.slice(0, 2);
  return visible + '***@' + domain;
}

function dashMaskUrl_(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  try {
    const parsed = new URL(value);
    return parsed.origin + parsed.pathname;
  } catch (_err) {
    return value.replace(/[?].*$/, '');
  }
}

function dashSetTextProp_(updates, key, value, maxLength) {
  if (typeof value === 'undefined') return;
  updates[key] = String(value || '').trim().slice(0, maxLength);
}

function dashSetIntProp_(updates, key, value, min, max) {
  if (typeof value === 'undefined') return;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(key + ' debe estar entre ' + min + ' y ' + max);
  }
  updates[key] = String(parsed);
}

function dashSetEmailProp_(updates, key, value) {
  if (typeof value === 'undefined') return;
  const clean = String(value || '').trim().slice(0, 180);
  if (clean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    throw new Error(key + ' no parece un correo valido');
  }
  updates[key] = clean;
}

function dashRound_(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function dashInt_(value, fallback) {
  const parsed = parseInt(value, 10);
  return parsed > 0 ? parsed : fallback;
}

function dashDaysBetween_(from, to) {
  const a = new Date(from + 'T00:00:00Z').getTime();
  const b = new Date(to + 'T00:00:00Z').getTime();
  if (isNaN(a) || isNaN(b)) return 9999;
  return Math.round((b - a) / 86400000);
}
