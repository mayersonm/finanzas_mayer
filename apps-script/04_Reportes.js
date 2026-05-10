// ---- BALANCE TOTAL
function sendBalance(chatId) {
  const data = obtenerTransacciones(chatId);

  let ingresos = 0, gastos = 0;
  data.forEach(row => {
    const tipo  = row[2];
    const monto = parseFloat(row[5]) || 0;
    if (tipo === 'ingreso') ingresos += monto;
    if (tipo === 'gasto')   gastos   += monto;
  });

  const balance = ingresos - gastos;
  const emoji   = balance >= 0 ? 'ðŸŸ¢' : 'ðŸ”´';

  sendMessage(chatId,
    `ðŸ’° *Tu Balance*\n\n` +
    `ðŸ“¥ Ingresos:  S/ ${ingresos.toFixed(2)}\n` +
    `ðŸ“¤ Gastos:    S/ ${gastos.toFixed(2)}\n` +
    `â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n` +
    `${emoji} Balance: S/ ${balance.toFixed(2)}\n\n` +
    `_${data.length} movimiento${data.length !== 1 ? 's' : ''} en total_`,
    true
  );
}

// ---- RESUMEN DEL MES
function sendResumen(chatId) {
  const hoy       = new Date();
  const mesActual = Utilities.formatDate(hoy, 'America/Lima', 'yyyy-MM');

  const data = obtenerTransacciones(chatId)
    .filter(row => Utilities.formatDate(new Date(row[0]), 'America/Lima', 'yyyy-MM') === mesActual);

  if (data.length === 0) {
    return sendMessage(chatId, 'ðŸ“­ No hay movimientos este mes todavÃ­a.');
  }

  // Solo calcula totales â€” categorÃ­as las maneja obtenerGastosPorMesCat
  let ingresos = 0, gastos = 0;
  data.forEach(row => {
    const monto = parseFloat(row[5]) || 0;
    if (row[2] === 'ingreso') ingresos += monto;
    else                      gastos   += monto;
  });

  // CategorÃ­as agrupadas y normalizadas (siempre minÃºscula)
  const porCat    = (obtenerGastosPorMesCat(chatId, mesActual)[mesActual]) || {};
  const lineasCat = Object.entries(porCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, monto]) => `  â€¢ ${capitalizar(cat)}: S/ ${monto.toFixed(2)}`)
    .join('\n');

  const meses     = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const nombreMes = meses[hoy.getMonth()];

  sendMessage(chatId,
    `ðŸ“Š *Resumen de ${nombreMes}*\n\n` +
    `ðŸ“¥ Ingresos: S/ ${ingresos.toFixed(2)}\n` +
    `ðŸ“¤ Gastos:   S/ ${gastos.toFixed(2)}\n` +
    `ðŸ’° Balance:  S/ ${(ingresos - gastos).toFixed(2)}\n\n` +
    `*Gastos por categorÃ­a:*\n${lineasCat || '  (sin gastos)'}`,
    true
  );
}


// ---- ÃšLTIMAS 5 TRANSACCIONES
function sendUltimos(chatId) {
  const data = obtenerTransacciones(chatId).slice(-5).reverse();

  if (data.length === 0) {
    return sendMessage(chatId, 'ðŸ“­ No tienes movimientos registrados aÃºn.');
  }

  const lineas = data.map(row => {
    const tipo  = row[2];
    const desc  = row[3];
    const monto = parseFloat(row[5]).toFixed(2);
    const fecha = row[0];
    const emoji = tipo === 'gasto' ? 'ðŸ”´' : 'ðŸŸ¢';
    return `${emoji} ${desc} â€” S/ ${monto} _(${Utilities.formatDate(new Date(fecha), Session.getScriptTimeZone(), 'dd/MM/yyyy')})_`;
  }).join('\n');

  sendMessage(chatId, `ðŸ“‹ *Ãšltimos movimientos:*\n\n${lineas}`, true);
}
// ---- EXPORTAR A CSV
function cmdExportar(chatId) {
  sendMessage(chatId, 'â³ Generando tu historial...', true);

  const data = obtenerTransacciones(chatId);
  if (!data.length) {
    return sendMessage(chatId, 'ðŸ“­ No tienes transacciones para exportar.');
  }

  const bom    = '\uFEFF';
  const header = 'Fecha,Hora,Tipo,DescripciÃ³n,CategorÃ­a,Monto\n';
  const rows   = data.map(r => {
    const fecha = Utilities.formatDate(new Date(r[0]), 'America/Lima', 'dd/MM/yyyy');
    const hora  = Utilities.formatDate(new Date(r[1]), 'America/Lima', 'HH:mm');
    const tipo  = r[2];
    const desc  = String(r[3]).replace(/"/g, '""'); // escapa comillas en descripciÃ³n
    const cat   = r[4];
    const monto = parseFloat(r[5]).toFixed(2);
    return `${fecha},${hora},${tipo},"${desc}",${cat},${monto}`;
  }).join('\n');

  const csv  = bom + header + rows;
  const mes  = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const blob = Utilities.newBlob(csv, 'text/csv', `finanzas_${mes}.csv`);

  UrlFetchApp.fetch(`https://api.telegram.org/bot${TOKEN}/sendDocument`, {
    method             : 'post',
    payload            : { chat_id: chatId, document: blob },
    muteHttpExceptions : true
  });
}


// ---- REPORTE SEMANAL AUTOMÃTICO
// Ejecuta setupReporteSemanal() UNA sola vez desde el editor
// para crear el trigger que corre cada lunes a las 8AM Lima

function reporteSemanal() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones');
  if (!sheet) return;

  // ObtÃ©n todos los chatIds Ãºnicos
  const chatIds = [...new Set(
    sheet.getDataRange().getValues().slice(1).map(r => String(r[6])).filter(Boolean)
  )];

  chatIds.forEach(chatId => enviarReporteSemanal(chatId));
}

function enviarReporteSemanal(chatId) {
  const hoy     = new Date();
  const lunes   = new Date(hoy); lunes.setDate(hoy.getDate() - 7);
  const domingo = new Date(hoy); domingo.setDate(hoy.getDate() - 1);

  const lunesFmt   = Utilities.formatDate(lunes,   'America/Lima', 'yyyy-MM-dd');
  const domingoFmt = Utilities.formatDate(domingo,  'America/Lima', 'yyyy-MM-dd');

  const txs = obtenerTransacciones(chatId).filter(r => {
    const f = Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM-dd');
    return f >= lunesFmt && f <= domingoFmt;
  });

  if (!txs.length) return;

  // Totales y categorÃ­as solo de las transacciones de esa semana
  let ingresos = 0, gastos = 0;
  const porCat = {};

  txs.forEach(r => {
    const monto = parseFloat(r[5]) || 0;
    if (r[2] === 'ingreso') {
      ingresos += monto;
    } else {
      gastos += monto;
      const cat = String(r[4]).toLowerCase(); // normaliza a minÃºscula
      porCat[cat] = (porCat[cat] || 0) + monto;
    }
  });

  const topCats = Object.entries(porCat)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([cat, m]) => `  â€¢ ${capitalizar(cat)}: S/ ${m.toFixed(2)}`)
    .join('\n');

  const rango = `${Utilities.formatDate(lunes,   'America/Lima', 'dd MMM')} â€“ ` +
                `${Utilities.formatDate(domingo, 'America/Lima', 'dd MMM')}`;

  sendMessage(chatId,
    `ðŸ“… *Reporte semanal*\n_${rango}_\n\n` +
    `ðŸ“¥ Ingresos: S/ ${ingresos.toFixed(2)}\n` +
    `ðŸ“¤ Gastos:   S/ ${gastos.toFixed(2)}\n` +
    `ðŸ’° Balance:  S/ ${(ingresos - gastos).toFixed(2)}\n\n` +
    (topCats ? `*Top gastos:*\n${topCats}\n\n` : '') +
    `_${txs.length} movimiento${txs.length !== 1 ? 's' : ''} esta semana_`,
    true
  );
}

function testUltimos() {
  const chatId = '123456789';
  sendUltimos(chatId);
}


// ---- RESUMEN DIARIO ----------------------------------------
function sendResumenDiario(chatId) {
  const hoy     = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
  const txsHoy  = obtenerTransacciones(chatId).filter(r =>
    Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM-dd') === hoy
  );

  if (!txsHoy.length) {
    return sendMessage(chatId, 'ðŸ“­ No registraste ningÃºn movimiento hoy.');
  }

  let ingresos = 0, gastos = 0;
  const porCat = {};

  txsHoy.forEach(r => {
    const monto = parseFloat(r[5]) || 0;
    if (r[2] === 'ingreso') {
      ingresos += monto;
    } else {
      gastos += monto;
      const cat = String(r[4]).toLowerCase();
      porCat[cat] = (porCat[cat] || 0) + monto;
    }
  });

  const lineasCat = Object.entries(porCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, m]) => `  â€¢ ${capitalizar(cat)}: S/ ${m.toFixed(2)}`)
    .join('\n');

  const fechaFmt = Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy');

  sendMessage(chatId,
    `ðŸŒ™ *Resumen del dÃ­a â€” ${fechaFmt}*\n\n` +
    `ðŸ“¥ Ingresos: S/ ${ingresos.toFixed(2)}\n` +
    `ðŸ“¤ Gastos:   S/ ${gastos.toFixed(2)}\n` +
    `ðŸ’° Balance:  S/ ${(ingresos - gastos).toFixed(2)}\n\n` +
    (lineasCat ? `*Por categorÃ­a:*\n${lineasCat}\n\n` : '') +
    `_${txsHoy.length} movimiento${txsHoy.length !== 1 ? 's' : ''} hoy_`,
    true
  );
}

// Llamada automÃ¡ticamente por el trigger cada noche
function resumenDiarioAutomatico() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones');
  if (!sheet) return;

  const chatIds = [...new Set(
    sheet.getDataRange().getValues().slice(1).map(r => String(r[6])).filter(Boolean)
  )];

  chatIds.forEach(chatId => sendResumenDiario(chatId));
  enviarResumenDiarioEmail();

  try {
    enviarResumenMensualSiCorrespondeEmail();
  } catch (e) {
    Logger.log('Error resumen mensual desde diario: ' + e.toString());
  }

  try {
    resumenAnualAutomatico();
  } catch (e) {
    Logger.log('Error resumen anual desde diario: ' + e.toString());
  }
}

// ---- BÃšSQUEDA DE TRANSACCIONES -----------------------------
// buscar almuerzo
// buscar kfc
// buscar freelance

function cmdBuscar(chatId, text) {
  const query = text.replace('buscar ', '').trim().toLowerCase();

  if (!query || query.length < 2) {
    return sendMessage(chatId,
      'âŒ Escribe al menos 2 caracteres.\nEj: `buscar almuerzo`', true);
  }

  const resultados = obtenerTransacciones(chatId).filter(r =>
    String(r[3]).toLowerCase().includes(query) ||
    String(r[4]).toLowerCase().includes(query)
  ).slice(-10).reverse();

  if (!resultados.length) {
    return sendMessage(chatId,
      `ðŸ” Sin resultados para *"${query}"*`, true);
  }

  const lineas = resultados.map(r => {
    const emoji = r[2] === 'gasto' ? 'ðŸ”´' : 'ðŸŸ¢';
    const fecha = Utilities.formatDate(new Date(r[0]), 'America/Lima', 'dd/MM/yyyy');
    const monto = parseFloat(r[5]).toFixed(2);
    return `${emoji} ${r[3]} â€” S/ ${monto} _(${fecha})_`;
  }).join('\n');

  sendMessage(chatId,
    `ðŸ” *"${query}"* â€” ${resultados.length} resultado${resultados.length !== 1 ? 's' : ''}\n\n${lineas}`,
    true
  );
}


// ---- PROYECCIÃ“N DE FIN DE MES ------------------------------
// Calcula a quÃ© ritmo vas y proyecta el balance al 31

function cmdProyeccion(chatId) {
  const hoy       = new Date();
  const mesActual = Utilities.formatDate(hoy, 'America/Lima', 'yyyy-MM');
  const diaHoy    = hoy.getDate();
  const diasMes   = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const diasRest  = diasMes - diaHoy;

  const data = obtenerTransacciones(chatId).filter(r =>
    Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM') === mesActual
  );

  if (!data.length) {
    return sendMessage(chatId, 'ðŸ“­ No hay movimientos este mes para proyectar.');
  }

  let ingresos = 0, gastos = 0;
  data.forEach(r => {
    const monto = parseFloat(r[5]) || 0;
    if (r[2] === 'ingreso') ingresos += monto;
    else                    gastos   += monto;
  });

  // Gasto diario promedio y proyecciÃ³n
  const gastoDiario   = gastos / diaHoy;
  const gastoProyect  = gastoDiario * diasMes;
  const balanceActual = ingresos - gastos;
  const balanceProyect = ingresos - gastoProyect;
  const emoji         = balanceProyect >= 0 ? 'ðŸŸ¢' : 'ðŸ”´';

  // Presupuestos para comparar
  const sheetPres = getOrCreateSheet('Presupuestos', ['ChatID','CategorÃ­a','LÃ­mite']);
  const totalPres = sheetPres.getDataRange().getValues().slice(1)
    .filter(r => String(r[0]) === chatId)
    .reduce((a, r) => a + parseFloat(r[2]), 0);

  const alertaPres = totalPres > 0 && gastoProyect > totalPres
    ? `\nâš ï¸ Proyectas superar tus presupuestos por S/ ${(gastoProyect - totalPres).toFixed(2)}`
    : '';

  sendMessage(chatId,
    `ðŸ“ˆ *ProyecciÃ³n â€” fin de mes*\n\n` +
    `ðŸ“… DÃ­a ${diaHoy} de ${diasMes} (faltan ${diasRest} dÃ­as)\n\n` +
    `ðŸ’¸ Gasto diario promedio: S/ ${gastoDiario.toFixed(2)}\n` +
    `ðŸ“¤ Gastos proyectados:    S/ ${gastoProyect.toFixed(2)}\n` +
    `ðŸ“¥ Ingresos actuales:     S/ ${ingresos.toFixed(2)}\n` +
    `â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n` +
    `${emoji} Balance proyectado: S/ ${balanceProyect.toFixed(2)}\n` +
    `ðŸ’° Balance actual:       S/ ${balanceActual.toFixed(2)}` +
    alertaPres,
    true
  );
}


// ---- ANÃLISIS CON IA (CLAUDE) ------------------------------
// Necesitas tu API key de Anthropic en Script Properties:
// Archivo â†’ Propiedades del proyecto â†’ claude_api_key
function cmdAnalisisIA(chatId) {
  // chatId = 1538086276;
  sendMessage(chatId, 'ðŸ¤– Analizando tus finanzas...', true);
 
  const hoy       = new Date();
  const mesActual = Utilities.formatDate(hoy, 'America/Lima', 'yyyy-MM');
  const meses     = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const nombreMes = meses[hoy.getMonth()];
 
  // Datos del mes
  const data = obtenerTransacciones(chatId).filter(r =>
    Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM') === mesActual
  );
 
  if (data.length < 3) {
    return sendMessage(chatId,
      'ðŸ“­ Necesito al menos 3 movimientos este mes para hacer un anÃ¡lisis Ãºtil.', true);
  }
 
  let ingresos = 0, gastos = 0;
  const porCat = {};
 
  data.forEach(r => {
    const monto = parseFloat(r[5]) || 0;
    if (r[2] === 'ingreso') {
      ingresos += monto;
    } else {
      gastos += monto;
      const cat = String(r[4]).toLowerCase();
      porCat[cat] = (porCat[cat] || 0) + monto;
    }
  });
 
  const resumenCats = Object.entries(porCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, m]) => `- ${cat}: S/ ${m.toFixed(2)}`)
    .join('\n');
 
  // Presupuestos activos
  const sheetPres    = getOrCreateSheet('Presupuestos', ['ChatID','CategorÃ­a','LÃ­mite']);
  const presupuestos = sheetPres.getDataRange().getValues().slice(1)
    .filter(r => String(r[0]) === chatId)
    .map(r => `- ${r[1]}: lÃ­mite S/ ${r[2]}`)
    .join('\n');
 
  // Metas activas
  const sheetMetas = getOrCreateSheet('Metas', ['ChatID','Nombre','Objetivo','Ahorrado','Creada']);
  const metas      = sheetMetas.getDataRange().getValues().slice(1)
    .filter(r => String(r[0]) === chatId)
    .map(r => `- ${r[1]}: S/ ${r[3]} de S/ ${r[2]} ahorrados`)
    .join('\n');
 
  const diaHoy      = hoy.getDate();
  const diasMes     = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const pctMes      = Math.round((diaHoy / diasMes) * 100);
  const gastoDiario = gastos / diaHoy;
  const gastoProyect = gastoDiario * diasMes;
 
  const prompt = [
  'Eres un asesor financiero personal para Mayeson, un desarrollador independiente en PerÃº.',
  'Analiza sus finanzas de este mes y da 5 consejos concretos con nÃºmeros reales.',
  '',
  'DATOS DEL MES:',
  `Mes: ${nombreMes} | DÃ­a ${diaHoy} de ${diasMes} (${pctMes}% del mes transcurrido)`,
  `Ingresos: S/ ${ingresos.toFixed(2)}`,
  `Gastos: S/ ${gastos.toFixed(2)}`,
  `Balance: S/ ${(ingresos - gastos).toFixed(2)}`,
  `Gasto diario promedio: S/ ${gastoDiario.toFixed(2)}`,
  `ProyecciÃ³n de gastos al cierre: S/ ${gastoProyect.toFixed(2)}`,
  `Â¿ProyecciÃ³n supera ingresos?: ${gastoProyect > ingresos ? 'SÃ âš ï¸' : 'No'}`,
  '',
  'GASTOS POR CATEGORÃA:',
  resumenCats,
  presupuestos ? `\nPRESUPUESTOS ACTIVOS:\n${presupuestos}` : '',
  metas        ? `\nMETAS DE AHORRO:\n${metas}`              : '',
  '',
  'REGLAS:',
  '- Responde en espaÃ±ol.',
  '- USA los nÃºmeros reales para dar contexto en cada consejo.',
  '- SÃ© especÃ­fico: menciona categorÃ­as, montos y fechas cuando ayude.',
  '- Si una categorÃ­a supera el 40% del gasto total, menciÃ³nala con su monto.',
  '- Si la proyecciÃ³n supera los ingresos, pon alerta en el punto 1.',
  '- Compara el gasto diario actual vs lo ideal para no pasarse.',
  '- Relaciona los consejos con las metas de ahorro si existen.',
  '- Tono cercano, directo y motivador. Nada de teorÃ­a.',
  '- Cierra con una frase corta de motivaciÃ³n.',
  '',
  'FORMATO EXACTO (respeta el markdown para Telegram):',
  'ðŸ’¡ *AnÃ¡lisis de ' + nombreMes + '*',
  '',
  '1. [consejo con nÃºmero real]',
  '2. [consejo con nÃºmero real]',
  '3. [consejo con nÃºmero real]',
  '4. [consejo con nÃºmero real]',
  '5. [consejo con nÃºmero real]',
  '',
  'ðŸ”¥ [frase motivadora corta]',
].join('\n');
 
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty('claude_api_key');
 
    if (!apiKey) {
      return sendMessage(chatId,
        'âŒ No hay API key configurada.\nRevisa las propiedades del script.', true);
    }
 
    const resp = UrlFetchApp.fetch('https://api.synterolink.com/v1/messages', {
      method : 'post',
      headers: {
        'x-api-key'        : apiKey,
        'anthropic-version': '2023-06-01',
        'content-type'     : 'application/json'
      },
      payload: JSON.stringify({
        model     : 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        messages  : [{ role: 'user', content: prompt }]
      }),
      muteHttpExceptions: true
    });
 
    const result = JSON.parse(resp.getContentText());
 
    if (result.error) {
      Logger.log('Error API: ' + JSON.stringify(result.error));
      return sendMessage(chatId,
        `âŒ Error de la API: ${result.error.message || 'desconocido'}`, true);
    }
 
    const consejo = result.content?.find(b => b.type === 'text')?.text;
 
    if (!consejo) {
      Logger.log('Respuesta inesperada: ' + JSON.stringify(result));
      return sendMessage(chatId, 'âŒ Respuesta vacÃ­a de la IA. Intenta de nuevo.', true);
    }
 
    sendMessage(chatId, consejo, true);
 
  } catch (err) {
    Logger.log('Error cmdAnalisisIA: ' + err.toString());
    sendMessage(chatId, 'âŒ Error al conectar con la IA. Intenta en unos segundos.', true);
  }
}

function alertarFijosPendientes() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Fijos');
  if (!sheet) return;

  const mes      = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const fijos    = sheet.getDataRange().getValues().slice(1);
  const cache    = CacheService.getScriptCache();

  // Agrupa por chatId
  const porChat = {};
  fijos.forEach(r => {
    const chatId = String(r[0]);
    if (!porChat[chatId]) porChat[chatId] = [];
    porChat[chatId].push({ nombre: r[1], monto: parseFloat(r[2]), cat: r[3] });
  });

  Object.entries(porChat).forEach(([chatId, fijosList]) => {
    // Transacciones registradas este mes
    const txsMes = obtenerTransacciones(chatId).filter(r =>
      Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM') === mes
    );

    // Filtra los que no estÃ¡n registrados y no fueron saltados
    const pendientes = fijosList.filter(f => {
      const saltado   = cache.get(`skip_fijo_${chatId}_${f.nombre.toLowerCase()}_${mes}`);
      const registrado = txsMes.some(r =>
        r[2] === 'gasto' && r[3].toLowerCase() === capitalizar(f.nombre).toLowerCase()
      );
      return !saltado && !registrado;
    });

    if (!pendientes.length) return;

    const lineas = pendientes.map(f =>
      `âš ï¸ ${capitalizar(f.nombre)} â€” S/ ${f.monto.toFixed(2)}`
    ).join('\n');

    const total = pendientes.reduce((a, f) => a + f.monto, 0);

    sendMessage(chatId,
      `ðŸ”” *Gastos fijos pendientes este mes*\n\n` +
      `${lineas}\n\n` +
      `â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n` +
      `ðŸ’¸ Total pendiente: S/ ${total.toFixed(2)}\n\n` +
      `_Â¿Ya los pagaste? RegÃ­stralos manualmente._\n` +
      `_Â¿No los pagarÃ¡s este mes? Usa \`saltar fijo [nombre]\`_`, true
    );
  });
}

// ---- COMPARAR MES ACTUAL VS MES ANTERIOR ------------------
// Uso: "comparar"

function cmdCompararMeses(chatId) {
  const hoy    = new Date();
  const mesAct = Utilities.formatDate(hoy, 'America/Lima', 'yyyy-MM');

  // Mes anterior
  const fechaAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const mesAnt   = Utilities.formatDate(fechaAnt, 'America/Lima', 'yyyy-MM');

  const meses    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const nomAct   = meses[hoy.getMonth()];
  const nomAnt   = meses[fechaAnt.getMonth()];

  const txs = obtenerTransacciones(chatId);

  function calcular(mes) {
    const data = txs.filter(r =>
      Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM') === mes
    );
    let ing = 0, gas = 0;
    const cats = {};
    data.forEach(r => {
      const m = parseFloat(r[5]) || 0;
      if (r[2] === 'ingreso') ing += m;
      else {
        gas += m;
        const c = String(r[4]).toLowerCase();
        cats[c] = (cats[c] || 0) + m;
      }
    });
    return { ing, gas, bal: ing - gas, cats, total: data.length };
  }

  const act = calcular(mesAct);
  const ant = calcular(mesAnt);

  if (!ant.total) {
    return sendMessage(chatId,
      `ðŸ“­ No hay datos de ${nomAnt} para comparar.`, true);
  }

  // Diferencias
  function diff(a, b) {
    if (b === 0) return a > 0 ? '+100%' : 'â€”';
    const pct = Math.round(((a - b) / b) * 100);
    return (pct >= 0 ? '+' : '') + pct + '%';
  }

  function flecha(a, b, menorEsBueno = false) {
    if (a === b) return 'âž¡ï¸';
    if (menorEsBueno) return a < b ? 'âœ…' : 'ðŸ”´';
    return a > b ? 'âœ…' : 'ðŸ”´';
  }

  // Top categorÃ­as combinadas
  const todasCats = new Set([
    ...Object.keys(act.cats),
    ...Object.keys(ant.cats)
  ]);

  const catLines = [...todasCats]
    .map(c => ({ cat: c, act: act.cats[c] || 0, ant: ant.cats[c] || 0 }))
    .sort((a, b) => b.act - a.act)
    .slice(0, 5)
    .map(c => {
      const f = flecha(c.act, c.ant, true);
      return `${f} ${capitalizar(c.cat)}: S/ ${c.act.toFixed(2)} vs S/ ${c.ant.toFixed(2)} (${diff(c.act, c.ant)})`;
    })
    .join('\n');

  sendMessage(chatId,
    `ðŸ“† *${nomAnt} vs ${nomAct}*\n\n` +
    `*Ingresos*\n` +
    `${flecha(act.ing, ant.ing)} ${nomAnt}: S/ ${ant.ing.toFixed(2)}\n` +
    `${flecha(act.ing, ant.ing)} ${nomAct}: S/ ${act.ing.toFixed(2)} (${diff(act.ing, ant.ing)})\n\n` +
    `*Gastos*\n` +
    `${flecha(act.gas, ant.gas, true)} ${nomAnt}: S/ ${ant.gas.toFixed(2)}\n` +
    `${flecha(act.gas, ant.gas, true)} ${nomAct}: S/ ${act.gas.toFixed(2)} (${diff(act.gas, ant.gas)})\n\n` +
    `*Balance*\n` +
    `${flecha(act.bal, ant.bal)} ${nomAnt}: S/ ${ant.bal.toFixed(2)}\n` +
    `${flecha(act.bal, ant.bal)} ${nomAct}: S/ ${act.bal.toFixed(2)} (${diff(act.bal, ant.bal)})\n\n` +
    `*Top categorÃ­as*\n${catLines}\n\n` +
    `_${ant.total} movimientos en ${nomAnt} Â· ${act.total} en ${nomAct}_`,
    true
  );
}

// ---- FOTO DE RECIBO CON IA ---------------------------------
// El usuario envÃ­a una foto de un ticket/recibo
// Claude extrae: monto, categorÃ­a, descripciÃ³n y lo registra

function procesarFotoRecibo(chatId, msg) {
  sendMessage(chatId, 'ðŸ“¸ Analizando tu recibo...', true);

  try {
    // Toma la foto de mayor resoluciÃ³n
    const foto    = msg.photo[msg.photo.length - 1];
    const fileId  = foto.file_id;

    // Obtiene la URL de descarga
    const fileResp = UrlFetchApp.fetch(
      `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${fileId}`,
      { muteHttpExceptions: true }
    );
    const filePath = JSON.parse(fileResp.getContentText()).result.file_path;
    const fileUrl  = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;

    // Descarga la imagen y convierte a base64
    const imageResp = UrlFetchApp.fetch(fileUrl, { muteHttpExceptions: true });
    const imageB64  = Utilities.base64Encode(imageResp.getContent());
    const mimeType  = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // EnvÃ­a a Claude con visiÃ³n
    const apiKey = PropertiesService.getScriptProperties().getProperty('claude_api_key');
    const resp   = UrlFetchApp.fetch('https://api.synterolink.com/v1/messages', {
      method : 'post',
      headers: {
        'x-api-key'        : apiKey,
        'anthropic-version': '2023-06-01',
        'content-type'     : 'application/json'
      },
      payload: JSON.stringify({
        model     : 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages  : [{
          role   : 'user',
          content: [
            {
              type  : 'image',
              source: { type: 'base64', media_type: mimeType, data: imageB64 }
            },
            {
              type: 'text',
              text:
                'Analiza este recibo o ticket de compra y extrae la informaciÃ³n.\n' +
                'Responde SOLO con este JSON exacto, sin explicaciones ni markdown:\n' +
                '{"monto": 45.50, "descripcion": "Almuerzo pollo a la brasa", "categoria": "comida"}\n\n' +
                'CategorÃ­as vÃ¡lidas: comida, transporte, servicios, entretenimiento, salud, ropa, educacion, otro\n' +
                'Si no puedes leer el monto exacto, estÃ­malo.\n' +
                'Si no es un recibo, responde: {"error": "No es un recibo"}'
            }
          ]
        }]
      }),
      muteHttpExceptions: true
    });

    const result = JSON.parse(resp.getContentText());
    const texto  = result.content?.find(b => b.type === 'text')?.text?.trim();

    if (!texto) {
      return sendMessage(chatId, 'âŒ No pude analizar la imagen. Intenta de nuevo.', true);
    }

    // Parsea el JSON que devuelve Claude
    let datos;
    try {
      datos = JSON.parse(texto);
    } catch(e) {
      Logger.log('JSON invÃ¡lido de Claude: ' + texto);
      return sendMessage(chatId, 'âŒ No pude leer el recibo. Â¿Es una foto clara del ticket?', true);
    }

    if (datos.error) {
      return sendMessage(chatId,
        'ðŸ“¸ Esa imagen no parece un recibo.\n\nEnvÃ­a una foto clara del ticket o agrega el gasto manualmente:\n`gasto 45 comida almuerzo`', true);
    }

    const monto = parseFloat(datos.monto);
    if (isNaN(monto) || monto <= 0) {
      return sendMessage(chatId, 'âŒ No pude leer el monto del recibo. AgrÃ©galo manualmente.', true);
    }

    // Registra automÃ¡ticamente en Sheets
    const fecha = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
    const hora  = Utilities.formatDate(new Date(), 'America/Lima', 'HH:mm');
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones')
      || crearHojaTransacciones();

    const desc = capitalizar(datos.descripcion || datos.categoria || 'Recibo');
    const cat  = normalizarCat(datos.categoria || 'otro', datos.descripcion || desc);

    sheet.appendRow([fecha, hora, 'gasto', desc, cat, monto, chatId]);
    guardarTransaccionD1({
      chatId: chatId,
      fecha: fecha,
      hora: hora,
      tipo: 'gasto',
      desc: desc,
      cat: cat,
      monto: monto,
      source: 'telegram_receipt',
    });

    // Verifica presupuesto
    verificarPresupuesto(chatId, cat);

    sendMessage(chatId,
      `ðŸ“¸ *Â¡Recibo registrado!*\n\n` +
      `ðŸ”´ ${desc}\n` +
      `ðŸ’µ S/ ${monto.toFixed(2)}\n` +
      `ðŸ·ï¸ ${capitalizar(cat)}\n` +
      `ðŸ“… ${fecha}\n\n` +
      `_Â¿El dato es incorrecto? ElimÃ­nalo con \`ultimos\` y agrÃ©galo manualmente._`,
      true
    );

  } catch (err) {
    Logger.log('Error procesarFotoRecibo: ' + err.toString());
    sendMessage(chatId, 'âŒ Error al procesar la foto. Intenta de nuevo.', true);
  }
}

