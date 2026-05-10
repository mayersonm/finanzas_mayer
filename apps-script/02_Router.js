function handleMessage(chatId, text) {
  const lower = text.toLowerCase().trim();

  // ── COMANDOS EXACTOS PRIMERO ─────────────────────────────
  switch (lower) {
    case '/start':
    case '/ayuda':
    case 'ayuda':
    case 'help':       return sendHelp(chatId);

    case '/balance':
    case 'balance':
    case 'saldo':      return sendBalance(chatId);

    case '/resumen':
    case 'resumen':
    case 'mes':        return sendResumen(chatId);

    case '/ultimos':
    case 'ultimos':
    case 'últimos':    return sendUltimos(chatId);

    case '/hoy':
    case 'hoy':        return sendResumenDiario(chatId);

    case '/exportar':
    case 'exportar':
    case 'export':     return cmdExportar(chatId);

    case '/metas':
    case 'metas':      return mostrarMetas(chatId);

    case 'fijos':      return cmdFijos(chatId, lower);

    case '/analisis':
    case 'analisis':
    case 'análisis':
    case 'consejos':   return cmdAnalisisIA(chatId);

    case '/proyeccion':
    case 'proyeccion':
    case 'proyección': return cmdProyeccion(chatId);

    case 'presupuesto': return cmdPresupuesto(chatId, lower);

    case '/comparar':
    case 'comparar': return cmdCompararMeses(chatId);

    case '/reales':
    case 'reales':
    case 'gastos reales':
    case 'comprometido': return cmdGastosReales(chatId);

    case '/anual':
    case 'anual':
    case 'resumen anual': return cmdResumenAnualEmail(chatId);

    case '/correo':
    case 'correo':
    case 'correos':
    case 'email': return cmdCorreo(chatId, text.trim());
  }

  // ── COMANDOS CON PARÁMETROS ──────────────────────────────
  if (lower.startsWith('presupuesto '))    return cmdPresupuesto(chatId, lower);
  if (lower.startsWith('meta '))           return cmdMetas(chatId, lower);
  if (lower.startsWith('ahorrar '))        return cmdAhorrar(chatId, lower);
  if (lower.startsWith('fijo '))           return cmdFijos(chatId, lower);
  if (lower.startsWith('pagar fijo '))     return cmdFijos(chatId, lower);
  if (lower.startsWith('eliminar fijo '))  return cmdFijos(chatId, lower);
  if (lower.startsWith('buscar '))         return cmdBuscar(chatId, lower);
  if (lower.startsWith('saltar fijo ')) return cmdFijos(chatId, lower);
  if (lower.startsWith('confirmar eliminar fijo ')) return cmdFijos(chatId, lower);
  if (lower.startsWith('correo '))        return cmdCorreo(chatId, text.trim());
  if (lower.startsWith('email '))         return cmdCorreo(chatId, text.trim().replace(/^email/i, 'correo'));
  

  // ── REGISTRAR MOVIMIENTO (siempre al final) ──────────────
  const match = lower.match(/^(gasto|ingreso)\s+([\d]+(?:[.,]\d{1,2})?)\s+(\w+)(?:\s+(.+))?$/);
  if (match) return registrarMovimiento(chatId, match, text);

  // ── NO RECONOCIDO ────────────────────────────────────────
  sendMessage(chatId,
    '❓ No entendí ese mensaje.\n\nEscribe *ayuda* para ver los comandos.',
    true
  );
}
