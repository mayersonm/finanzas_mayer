
function normalizarCat(cat, desc) {
  const rawCat = normalizarTextoClave_(cat);
  const rawDesc = normalizarTextoClave_(desc);
  const text = (rawCat + ' ' + rawDesc).trim();

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
    kfc: 'comida',
    popeyes: 'comida',
    bembos: 'comida',
    mcdonalds: 'comida',
    pizza: 'comida',
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
    gas: 'servicios',

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
    { cat: 'comida', words: ['kfc', 'popeyes', 'bembos', 'mcdonalds', 'pollo', 'pizza', 'almuerzo', 'cena', 'desayuno', 'yogurt', 'leche'] },
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
