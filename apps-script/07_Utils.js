
function normalizarCat(cat, desc) {
  const rawCat = normalizarTextoClave_(cat);
  const rawDesc = normalizarTextoClave_(desc);
  const text = (rawCat + ' ' + rawDesc).trim();

  if (/(recibo de gas|recibo gas|servicio de gas|servicio gas|gas natural|calidda)/.test(text)) {
    return 'servicios';
  }

  if (/(gasolina|combustible|gas al carro|gas para carro|gnv|glp|grifo|primax|repsol|pecsa|petroperu)/.test(text) || rawCat === 'gas') {
    return 'transporte';
  }

  if (/(kfc|popeyes|bembos|mcdonalds|mc donald|burger king|pizza hut|dominos|domino s|papa john|comida rapida|fast food|hamburguesa|salchipapa)/.test(text)) {
    return 'entretenimiento';
  }

  const direct = {
    alimentacion: 'comida',
    alimento: 'comida',
    alimentos: 'comida',
    comida: 'comida',
    almuerzo: 'comida',
    cena: 'comida',
    desayuno: 'comida',
    merienda: 'comida',
    snack: 'comida',
    cafe: 'comida',
    restaurant: 'comida',
    restaurante: 'comida',
    mercado: 'supermercado',
    supermercado: 'supermercado',
    super: 'supermercado',
    wong: 'supermercado',
    metro: 'supermercado',
    tottus: 'supermercado',
    makro: 'supermercado',
    vivanda: 'supermercado',
    kfc: 'entretenimiento',
    popeyes: 'entretenimiento',
    bembos: 'entretenimiento',
    mcdonalds: 'entretenimiento',
    pizza: 'entretenimiento',
    pollo: 'comida',

    transporte: 'transporte',
    taxi: 'transporte',
    bus: 'transporte',
    uber: 'transporte',
    didi: 'transporte',
    indrive: 'transporte',
    gasolina: 'transporte',
    combustible: 'transporte',
    carro: 'transporte',
    peaje: 'transporte',
    estacionamiento: 'transporte',

    servicios: 'servicios',
    servicio: 'servicios',
    luz: 'servicios',
    agua: 'servicios',
    internet: 'servicios',
    alquiler: 'servicios',
    renta: 'servicios',
    telefono: 'servicios',
    celular: 'servicios',
    gas: 'transporte',

    entretenimiento: 'entretenimiento',
    cine: 'entretenimiento',
    netflix: 'entretenimiento',
    spotify: 'entretenimiento',
    juegos: 'entretenimiento',
    juego: 'entretenimiento',
    steam: 'entretenimiento',
    disney: 'entretenimiento',

    salud: 'salud',
    medico: 'salud',
    farmacia: 'salud',
    doctor: 'salud',
    clinica: 'salud',
    medicina: 'salud',

    ropa: 'ropa',
    vestir: 'ropa',
    zapatillas: 'ropa',
    zapatos: 'ropa',

    educacion: 'educacion',
    curso: 'educacion',
    cursos: 'educacion',
    libro: 'educacion',
    libros: 'educacion',
    universidad: 'educacion',

    salario: 'salario',
    sueldo: 'salario',
    trabajo: 'salario',
    planilla: 'salario',

    freelance: 'freelance',
    proyecto: 'freelance',
    cliente: 'freelance',
    serviciofreelance: 'freelance',

    inversion: 'inversion',
    venta: 'venta',
    otro: 'otro',
    otros: 'otro',
  };

  if (direct[rawCat]) return direct[rawCat];

  const rules = [
    { cat: 'supermercado', words: ['supermercado', 'mercado', 'wong', 'metro', 'tottus', 'makro', 'vivanda', 'plaza vea'] },
    { cat: 'entretenimiento', words: ['kfc', 'popeyes', 'bembos', 'mcdonalds', 'mc donald', 'burger king', 'pizza hut', 'dominos', 'papa john', 'comida rapida', 'fast food', 'hamburguesa', 'salchipapa'] },
    { cat: 'comida', words: ['pollo', 'almuerzo', 'cena', 'desayuno', 'yogurt', 'leche'] },
    { cat: 'transporte', words: ['taxi', 'uber', 'didi', 'indrive', 'gasolina', 'combustible', 'peaje', 'estacionamiento', 'carro'] },
    { cat: 'servicios', words: ['internet', 'alquiler', 'renta', 'luz', 'agua', 'telefono', 'celular', 'recibo de gas'] },
    { cat: 'entretenimiento', words: ['netflix', 'spotify', 'juegos', 'steam', 'cine', 'disney'] },
    { cat: 'salud', words: ['farmacia', 'medicina', 'doctor', 'clinica', 'medico'] },
    { cat: 'ropa', words: ['zapatilla', 'zapato', 'camisa', 'polo', 'pantalon'] },
    { cat: 'educacion', words: ['curso', 'libro', 'universidad', 'clase'] },
  ];

  for (let i = 0; i < rules.length; i++) {
    for (let j = 0; j < rules[i].words.length; j++) {
      if (text.indexOf(rules[i].words[j]) >= 0) return rules[i].cat;
    }
  }

  return rawCat || 'otro';
}

function categoriasParaPresupuesto_(cat) {
  const key = normalizarCat(cat || 'otro');
  if (key === 'comida') return ['comida', 'supermercado'];
  return [key || 'otro'];
}

function gastoPresupuestoPorCategoria_(gastosCat, cat) {
  const keys = categoriasParaPresupuesto_(cat);
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
