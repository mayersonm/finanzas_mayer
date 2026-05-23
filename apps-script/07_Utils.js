
function normalizarCat(cat, desc, chatId) {
  const remote = clasificarCategoriaD1_(cat, desc, chatId);
  return remote || normalizarCatBasica_(cat);
}

function normalizarCatBasica_(cat) {
  const rawCat = normalizarTextoClave_(cat);

  const direct = {
    alimentacion: 'comida',
    alimento: 'comida',
    alimentos: 'comida',
    comida: 'comida',
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
  if (key === 'comida') return ['comida', 'supermercado'];
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

// ---- NUEVA: barra de progreso visual --------------
function buildBar(pct) {
  const filled = Math.round(Math.min(pct, 100) / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
