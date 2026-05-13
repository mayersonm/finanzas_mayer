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

    if (action === 'stats') {
      return dashJson_(dashStats_(params));
    }

    return dashJson_({
      ok: false,
      error: 'Accion no valida',
      validActions: ['health', 'dashboard', 'txs', 'stats'],
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
    meses: dashLastMonths_(allTxs, now),
    presupuestos: presupuestos,
    fijos: fijos,
    gastosReales: dashRealExpenses_(fijos, presupuestos),
    metas: dashReadGoals_(params),
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

  return {
    ok: true,
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    sheets: {
      transacciones: Boolean(ss.getSheetByName('Transacciones')),
      presupuestos: Boolean(ss.getSheetByName('Presupuestos')),
      metas: Boolean(ss.getSheetByName('Metas')),
      fijos: Boolean(ss.getSheetByName('Fijos')),
      cierresMensuales: Boolean(ss.getSheetByName('CierresMensuales')),
    },
    emailConfig: dashEmailConfig_(),
    checkedAt: Utilities.formatDate(new Date(), DASH_TZ, "yyyy-MM-dd'T'HH:mm:ss"),
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

      return {
        id: String(index + 2),
        fecha: fecha,
        hora: dashDate_(row[1], 'HH:mm') || '00:00',
        tipo: String(row[2] || '').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto',
        desc: String(row[3] || 'Sin descripcion'),
        cat: String(row[4] || 'otro').toLowerCase(),
        monto: dashRound_(Math.abs(parseFloat(row[5]) || 0)),
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
        gasto: dashRound_(spending[cat.toLowerCase()] || 0),
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

function dashRound_(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function dashInt_(value, fallback) {
  const parsed = parseInt(value, 10);
  return parsed > 0 ? parsed : fallback;
}
