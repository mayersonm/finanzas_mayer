
// ---- HELPERS -----------------------------------------------
function obtenerTransacciones(chatId) {
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
  sheet.appendRow(['Fecha', 'Hora', 'Tipo', 'Descripción', 'Categoría', 'Monto', 'ChatID']);
  sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  return sheet;
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
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Transacciones');
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues().slice(1);
  const resultado = {};

  data.forEach(r => {
    if (String(r[6]) !== chatId) return;
    if (r[2] !== 'gasto') return;

    const fechaMes = Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM');
    if (mes && fechaMes !== mes) return;

    const cat   = String(r[4]).toLowerCase();
    const monto = parseFloat(r[5]) || 0;

    if (!resultado[fechaMes]) resultado[fechaMes] = {};
    resultado[fechaMes][cat] = (resultado[fechaMes][cat] || 0) + monto;
  });

  return resultado;
}