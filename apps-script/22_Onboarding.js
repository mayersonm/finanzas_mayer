// ---- ONBOARDING TELEGRAM ------------------------------------

function cmdOnboarding(chatId) {
  registrarUsuarioTelegramD1_(chatId, '', '');

  const text = [
    '*Bienvenido a ' + APP_NAME + '*',
    '',
    'Tu usuario de Telegram ya quedo detectado:',
    '`' + chatId + '`',
    '',
    '*Primeros pasos*',
    '1. Entra al dashboard y abre *Config* para tus preferencias.',
    '2. Abre *Admin* para categorias y reglas.',
    '3. Registra un gasto desde Telegram o el dashboard.',
    '',
    '*Comandos utiles*',
    '• `perfil Mayer mayer@email.com` - poner nombre/correo',
    '• `gasto 25 comida almuerzo`',
    '• `gasto 120 supermercado metro credito`',
    '• Envia una foto clara de un recibo',
    '• `ayuda` - ver comandos',
    '',
    '*Dashboard*',
    dashboardUrlOnboarding_(),
  ].join('\n');

  return sendMessage(chatId, text, true);
}

function cmdPerfil(chatId, text) {
  const clean = String(text || '').replace(/^perfil\s+/i, '').trim();
  if (!clean) {
    return sendMessage(chatId,
      '*Perfil*\n\n' +
      'Usa:\n' +
      '`perfil Tu Nombre tu@email.com`\n\n' +
      'Tu Chat ID es:\n`' + chatId + '`',
      true
    );
  }

  const emailMatch = clean.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  const email = emailMatch ? emailMatch[0] : '';
  const name = clean.replace(email, '').trim();
  const result = registrarUsuarioTelegramD1_(chatId, name, email);

  if (!result) {
    return sendMessage(chatId,
      'No pude guardar tu perfil en D1 en este momento, pero tu Chat ID es:\n`' + chatId + '`',
      true
    );
  }

  return sendMessage(chatId,
    '*Perfil actualizado*\n\n' +
    'Nombre: *' + (name || 'Sin nombre') + '*\n' +
    'Correo: *' + (email || 'Sin correo') + '*\n' +
    'Chat ID: `' + chatId + '`\n\n' +
    'Ahora puedes configurar categorias y preferencias desde el dashboard.',
    true
  );
}

function registrarUsuarioTelegramD1_(chatId, name, email) {
  try {
    return d1ApiRequest_('/api/users/link', {
      chat_id: String(chatId),
      name: name || '',
      email: email || '',
    });
  } catch (err) {
    Logger.log('Onboarding D1 omitido: ' + err);
    return null;
  }
}

function dashboardUrlOnboarding_() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('dashboard_url') ||
    props.getProperty('dashboard_pages_url') ||
    'Abre tu URL de Cloudflare Pages del dashboard.';
}
