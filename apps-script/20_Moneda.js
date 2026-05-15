// ---- MONEDA -------------------------------------------------

var MONEDAS_VALIDAS = ['PEN', 'USD'];

function normalizarMoneda_(value) {
  const moneda = String(value || 'PEN').trim().toUpperCase();
  return MONEDAS_VALIDAS.indexOf(moneda) >= 0 ? moneda : '';
}

function simboloMoneda_(value) {
  return normalizarMoneda_(value) === 'USD' ? 'US$' : 'S/';
}

function formatoMoneda_(monto, moneda) {
  return simboloMoneda_(moneda) + ' ' + Number(monto || 0).toFixed(2);
}

function extraerMonedaDeTexto_(text) {
  const raw = String(text || '').trim();
  if (!raw) return { texto: '', moneda: 'PEN', error: '' };

  const partes = raw.split(/\s+/);
  const primera = partes[0] ? partes[0].toUpperCase() : '';
  const ultima = partes.length ? partes[partes.length - 1].toUpperCase() : '';

  if (MONEDAS_VALIDAS.indexOf(primera) >= 0) {
    return { texto: partes.slice(1).join(' '), moneda: primera, error: '' };
  }

  if (MONEDAS_VALIDAS.indexOf(ultima) >= 0) {
    return { texto: partes.slice(0, -1).join(' '), moneda: ultima, error: '' };
  }

  return { texto: raw, moneda: 'PEN', error: '' };
}
