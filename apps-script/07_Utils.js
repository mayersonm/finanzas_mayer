
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

// ---- NUEVA: barra de progreso visual --------------
function buildBar(pct) {
  const filled = Math.round(Math.min(pct, 100) / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
