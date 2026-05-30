
function normalizarCat(cat, desc, chatId) {
  const remote = clasificarCategoriaD1_(cat, desc, chatId);
  return normalizarCatBasica_(remote || cat);
}

function normalizarCatBasica_(cat) {
  const rawCat = normalizarTextoClave_(cat);

  const direct = {
    alimentacion: 'supermercado',
    alimento: 'supermercado',
    alimentos: 'supermercado',
    comida: 'supermercado',
    mercado: 'supermercado',
    supermercado: 'supermercado',
    fruta: 'supermercado',
    frutas: 'supermercado',
    hortaliza: 'supermercado',
    hortalizas: 'supermercado',
    verdura: 'supermercado',
    verduras: 'supermercado',
    transporte: 'transporte',
    servicios: 'servicios',
    servicio: 'servicios',
    entretenimiento: 'entretenimiento',
    salud: 'salud',
    ropa: 'ropa',
    educacion: 'educacion',
    salario: 'salario',
    sueldo: 'salario',
    freelance: 'freelance',
    deuda: 'deudas',
    deudas: 'deudas',
    prestamo: 'deudas',
    prestamos: 'deudas',
    inversion: 'inversion',
    venta: 'venta',
    otro: 'otro',
    otros: 'otro',
  };

  if (direct[rawCat]) return direct[rawCat];
  return 'otro';
}

function categoriasParaPresupuesto_(cat, chatId) {
  const key = normalizarCatBasica_(cat || 'otro');
  const remote = categoriasPresupuestoD1_(key, chatId);
  if (remote && remote.length) return remote;
  return [key || 'otro'];
}

function gastoPresupuestoPorCategoria_(gastosCat, cat, chatId) {
  const keys = categoriasParaPresupuesto_(cat, chatId);
  return keys.reduce(function (total, key) {
    return total + (parseFloat(gastosCat[key]) || 0);
  }, 0);
}

function normalizarTextoClave_(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalizar(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function fechaLocalDesdeValor_(value) {
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

function fechaKey_(value) {
  return Utilities.formatDate(fechaLocalDesdeValor_(value), 'America/Lima', 'yyyy-MM-dd');
}

function mesKey_(value) {
  return Utilities.formatDate(fechaLocalDesdeValor_(value), 'America/Lima', 'yyyy-MM');
}

function fechaCorta_(value) {
  return Utilities.formatDate(fechaLocalDesdeValor_(value), 'America/Lima', 'dd/MM/yyyy');
}

function horaLocalDesdeValor_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return new Date(2000, 0, 1, value.getHours(), value.getMinutes());
  }

  const match = String(value || '00:00').match(/^(\d{1,2}):(\d{2})/);
  return new Date(2000, 0, 1, match ? Number(match[1]) : 0, match ? Number(match[2]) : 0);
}

function horaKey_(value) {
  return Utilities.formatDate(horaLocalDesdeValor_(value), 'America/Lima', 'HH:mm');
}

function cicloPagoDesdeFecha_(value) {
  const base = fechaLocalDesdeValor_(value || new Date());
  const start = base.getDate() >= 23
    ? new Date(base.getFullYear(), base.getMonth(), 23)
    : new Date(base.getFullYear(), base.getMonth() - 1, 23);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 22);
  const startKey = fechaKey_(start);
  const endKey = fechaKey_(end);
  const close = new Date(start.getFullYear(), start.getMonth() + 1, 23);
  const closeKey = fechaKey_(close);

  return {
    start: start,
    end: end,
    close: close,
    startKey: startKey,
    endKey: endKey,
    closeKey: closeKey,
    key: Utilities.formatDate(start, 'America/Lima', 'yyyy-MM'),
    label: 'Cierre ' + Utilities.formatDate(close, 'America/Lima', 'dd/MM/yyyy'),
    shortLabel: 'Cierre ' + Utilities.formatDate(close, 'America/Lima', 'dd/MM'),
    rangeLabel: Utilities.formatDate(start, 'America/Lima', 'dd/MM/yyyy') + ' - ' + Utilities.formatDate(end, 'America/Lima', 'dd/MM/yyyy'),
  };
}

function cicloPagoCerrado_(value) {
  const base = fechaLocalDesdeValor_(value || new Date());
  base.setDate(base.getDate() - 1);
  return cicloPagoDesdeFecha_(base);
}

function cicloPagoRelativo_(periodo, offset) {
  const p = periodo && periodo.start ? periodo : cicloPagoDesdeFecha_(periodo || new Date());
  return cicloPagoDesdeFecha_(new Date(p.start.getFullYear(), p.start.getMonth() + offset, p.start.getDate()));
}

function filtrarTransaccionesCiclo_(txs, periodo) {
  const p = periodo && periodo.startKey ? periodo : cicloPagoDesdeFecha_(periodo || new Date());
  return (txs || []).filter(function (r) {
    const key = fechaKey_(r[0]);
    return key >= p.startKey && key <= p.endKey;
  });
}

function diasTranscurridosCiclo_(periodo, value) {
  const p = periodo && periodo.start ? periodo : cicloPagoDesdeFecha_(periodo || new Date());
  const currentKey = fechaKey_(value || new Date());
  const cappedKey = currentKey < p.startKey ? p.startKey : currentKey > p.endKey ? p.endKey : currentKey;
  const current = fechaLocalDesdeValor_(cappedKey);
  return Math.max(1, Math.floor((current.getTime() - p.start.getTime()) / 86400000) + 1);
}

function diasTotalesCiclo_(periodo) {
  const p = periodo && periodo.start ? periodo : cicloPagoDesdeFecha_(periodo || new Date());
  return Math.max(1, Math.floor((p.end.getTime() - p.start.getTime()) / 86400000) + 1);
}

// ---- NUEVA: barra de progreso visual --------------
function buildBar(pct) {
  const filled = Math.round(Math.min(pct, 100) / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
