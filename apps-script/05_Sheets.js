// ---- HELPERS -----------------------------------------------
function obtenerTransacciones(chatId) {
  const txsD1 = leerTransaccionesD1_(chatId, 500);
  if (txsD1 !== null) {
    return txsD1.slice().reverse().map(function (tx) {
      return [
        tx.fecha,
        tx.hora || '00:00',
        tx.tipo || 'gasto',
        tx.desc || '',
        tx.cat || 'otro',
        Number(tx.monto || 0),
        String(chatId),
        tx.paymentMethod || tx.payment_method || 'debito',
        tx.paymentDueDate || tx.payment_due_date || '',
        tx.cardName || tx.card_name || '',
        normalizarMoneda_(tx.currency || tx.moneda) || 'PEN',
      ];
    });
  }

  return obtenerTransaccionesSheets_(chatId);
}

function obtenerTransaccionesSheets_(chatId) {
  try {
    const sheet = SpreadsheetApp
      .openById(SHEET_ID)
      .getSheetByName('Transacciones');

    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();

    return data
      .slice(1)
      .filter(row =>
        String(row[6]).trim() === String(chatId).trim()
      );

  } catch (e) {
    Logger.log('Error obtenerTransacciones: ' + e);
    return [];
  }
}

function crearHojaTransacciones() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.insertSheet('Transacciones');
  sheet.appendRow(['Fecha', 'Hora', 'Tipo', 'Descripcion', 'Categoria', 'Monto', 'ChatID', 'MetodoPago', 'FechaPago', 'Tarjeta', 'Moneda']);
  sheet.getRange(1, 1, 1, 11).setFontWeight('bold');
  return sheet;
}

function asegurarColumnasPagoTransacciones_(sheet) {
  if (!sheet) return;

  const headers = ['MetodoPago', 'FechaPago', 'Tarjeta', 'Moneda'];
  for (let i = 0; i < headers.length; i++) {
    const col = 8 + i;
    const value = String(sheet.getRange(1, col).getValue() || '').trim();
    if (!value) sheet.getRange(1, col).setValue(headers[i]);
  }

  sheet.getRange(1, 1, 1, 11).setFontWeight('bold');
}

// ---- NUEVA: crear hoja si no existe ----------------
function getOrCreateSheet(name, headers) {
  const ss  = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function obtenerGastosPorMesCat(chatId, mes = null) {
  const data = obtenerTransacciones(chatId);
  const resultado = {};

  data.forEach(r => {
    if (String(r[6]).trim() !== String(chatId).trim()) return;
    if (r[2] !== 'gasto') return;

    const fechaMes = Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM');
    if (mes && fechaMes !== mes) return;

    const cat   = normalizarCat(r[4], r[3], chatId);
    const monto = parseFloat(r[5]) || 0;

    if (!resultado[fechaMes]) resultado[fechaMes] = {};
    resultado[fechaMes][cat] = (resultado[fechaMes][cat] || 0) + monto;
  });

  return resultado;
}
