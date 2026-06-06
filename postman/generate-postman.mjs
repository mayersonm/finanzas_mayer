import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

const collection = {
  info: {
    name: 'Finanzas Mayeson API',
    description: [
      'Coleccion para probar el Worker D1 de Finanzas Mayeson.',
      '',
      'Flujo recomendado:',
      '1. Selecciona el environment Finanzas Mayeson.',
      '2. Llena login_email y login_password, o llena auth_token con dashboard_api_key.',
      '3. Ejecuta Auth / Login para guardar session_token y auth_token automaticamente.',
      '4. Para endpoints admin-only, llena admin_key.',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{auth_token}}', type: 'string' }],
  },
  event: [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          "if (!pm.environment.get('auth_token') && pm.environment.get('dashboard_api_key')) {",
          "  pm.environment.set('auth_token', pm.environment.get('dashboard_api_key'));",
          '}',
          "if (!pm.environment.get('today')) {",
          "  pm.environment.set('today', new Date().toISOString().slice(0, 10));",
          '}',
        ],
      },
    },
  ],
  item: [
    folder('00 Salud y Auth', [
      request('Health', 'GET', '/health', { auth: 'noauth' }),
      request('Login', 'POST', '/api/login', {
        auth: 'noauth',
        body: {
          email: '{{login_email}}',
          password: '{{login_password}}',
        },
        tests: [
          'const data = pm.response.json();',
          'if (data.token) {',
          "  pm.environment.set('session_token', data.token);",
          "  pm.environment.set('auth_token', data.token);",
          '}',
        ],
      }),
      request('Validar sesion', 'GET', '/api/session'),
      request('Logout', 'POST', '/api/logout'),
      request('Cambiar clave', 'POST', '/api/password', {
        body: {
          currentPassword: '{{login_password}}',
          newPassword: '{{new_password}}',
        },
      }),
    ]),

    folder('01 Dashboard', [
      request('Dashboard principal', 'GET', '/api/dashboard?chat_id={{chat_id}}'),
      request('Calendario mensual', 'GET', '/api/calendar?chat_id={{chat_id}}&calendar_month={{calendar_month}}'),
      request('Tipo de cambio USD/PEN', 'GET', '/api/exchange-rate'),
      request('Patrimonio', 'GET', '/api/net-worth?chat_id={{chat_id}}'),
      request('Guardar corte de patrimonio', 'POST', '/api/net-worth/snapshot?chat_id={{chat_id}}'),
      request('Listar cierres', 'GET', '/api/closures?chat_id={{chat_id}}'),
      request('Guardar cierre', 'POST', '/api/closures?chat_id={{chat_id}}', {
        body: {
          cycle_start: '{{cycle_start}}',
          dryRun: true,
        },
      }),
    ]),

    folder('02 Movimientos', [
      request('Listar movimientos', 'GET', '/api/transactions?chat_id={{chat_id}}&limit={{limit}}&q={{search}}&category={{category}}'),
      request('Crear movimiento (admin)', 'POST', '/api/transactions', {
        admin: true,
        body: {
          chat_id: '{{chat_id}}',
          fecha: '{{today}}',
          hora: '12:00',
          tipo: 'gasto',
          desc: 'Prueba Postman',
          cat: 'otro',
          monto: 1,
          currency: 'PEN',
          payment_method: 'debito',
        },
        tests: saveVar('transaction_id', 'transaction.id'),
      }),
      request('Editar movimiento', 'PATCH', '/api/transactions/{{transaction_id}}?chat_id={{chat_id}}', {
        body: {
          fecha: '{{today}}',
          hora: '12:00',
          tipo: 'gasto',
          desc: 'Prueba Postman editada',
          cat: 'supermercado',
          monto: 1.5,
          currency: 'PEN',
          payment_method: 'debito',
        },
      }),
      request('Eliminar movimiento', 'DELETE', '/api/transactions/{{transaction_id}}?chat_id={{chat_id}}'),
      request('Cambiar categoria (admin)', 'POST', '/api/transactions/category', {
        admin: true,
        body: {
          chat_id: '{{chat_id}}',
          id: '{{transaction_id}}',
          category: 'supermercado',
        },
      }),
      request('Cambiar pago (admin)', 'POST', '/api/transactions/payment', {
        admin: true,
        body: {
          chat_id: '{{chat_id}}',
          id: '{{transaction_id}}',
          payment_method: 'credito',
          payment_due_date: '{{payment_due_date}}',
          card_name: '{{card_name}}',
        },
      }),
    ]),

    folder('03 Compromisos', [
      request('Crear/actualizar presupuesto', 'POST', '/api/budgets?chat_id={{chat_id}}', {
        body: {
          chat_id: '{{chat_id}}',
          cat: 'supermercado',
          limite: 1200,
        },
      }),
      request('Crear gasto fijo', 'POST', '/api/fixed-expenses?chat_id={{chat_id}}', {
        body: {
          chat_id: '{{chat_id}}',
          nombre: 'Internet Postman',
          monto: 120,
          currency: 'PEN',
          cat: 'servicios',
        },
        tests: saveVar('fixed_id', 'fixedExpense.id'),
      }),
      request('Editar gasto fijo', 'PATCH', '/api/fixed-expenses/{{fixed_id}}?chat_id={{chat_id}}', {
        body: {
          nombre: 'Internet Postman',
          monto: 130,
          currency: 'PEN',
          cat: 'servicios',
        },
      }),
      request('Marcar fijo pagado/saltado', 'POST', '/api/fixed-expenses/{{fixed_id}}/status?chat_id={{chat_id}}', {
        body: {
          chat_id: '{{chat_id}}',
          status: 'pagado',
          month_key: '{{month_key}}',
          paid_date: '{{today}}',
          notes: 'Postman',
        },
      }),
      request('Eliminar gasto fijo', 'DELETE', '/api/fixed-expenses/{{fixed_id}}?chat_id={{chat_id}}'),
      request('Crear deuda', 'POST', '/api/debts', {
        body: {
          chat_id: '{{chat_id}}',
          nombre: 'Deuda Postman',
          monto: 150,
          pagado: 0,
          currency: 'USD',
          vencimiento: '{{payment_due_date}}',
          notas: 'Prueba Postman',
        },
        tests: saveVar('debt_id', 'debt.id'),
      }),
      request('Editar deuda', 'PATCH', '/api/debts/{{debt_id}}?chat_id={{chat_id}}', {
        body: {
          nombre: 'Deuda Postman',
          total: 150,
          pagado: 10,
          currency: 'USD',
          vencimiento: '{{payment_due_date}}',
          notas: 'Actualizada desde Postman',
        },
      }),
      request('Registrar pago de deuda', 'POST', '/api/debts/{{debt_id}}/payments?chat_id={{chat_id}}', {
        body: {
          chat_id: '{{chat_id}}',
          amount: 10,
          currency: 'USD',
          payment_date: '{{today}}',
          notes: 'Pago Postman',
          record_transaction: true,
        },
      }),
      request('Eliminar deuda', 'DELETE', '/api/debts/{{debt_id}}?chat_id={{chat_id}}'),
    ]),

    folder('04 Inversiones', [
      request('Listar inversiones', 'GET', '/api/investments?chat_id={{chat_id}}'),
      request('Crear inversion', 'POST', '/api/investments?chat_id={{chat_id}}', {
        body: {
          chat_id: '{{chat_id}}',
          name: 'Inversion Postman',
          kind: 'fondo',
          amount: 100,
          currentValue: 105,
          currency: 'USD',
          notes: 'Prueba Postman',
        },
        tests: saveVar('investment_id', 'investment.id'),
      }),
      request('Editar inversion', 'PATCH', '/api/investments/{{investment_id}}?chat_id={{chat_id}}', {
        body: {
          name: 'Inversion Postman',
          kind: 'fondo',
          amount: 100,
          currentValue: 110,
          currency: 'USD',
          notes: 'Actualizada desde Postman',
        },
      }),
      request('Eliminar inversion', 'DELETE', '/api/investments/{{investment_id}}?chat_id={{chat_id}}'),
    ]),

    folder('05 Configuracion y Reglas', [
      request('Leer settings', 'GET', '/api/settings?chat_id={{chat_id}}'),
      request('Guardar settings', 'POST', '/api/settings?chat_id={{chat_id}}', {
        body: {
          creditCutDay: 25,
          creditPayDay: 10,
          payday: 23,
          savingsTargetAmount: 0,
          emergencyBufferAmount: 0,
          investorProfile: 'conservador',
          investmentHorizon: 'corto',
        },
      }),
      request('Categorias', 'GET', '/api/categories?chat_id={{chat_id}}'),
      request('Guardar categoria', 'POST', '/api/categories?chat_id={{chat_id}}', {
        body: {
          key: '{{category}}',
          label: 'Categoria Postman',
          color: '#64748b',
          keywords: ['postman', 'prueba'],
          active: true,
        },
      }),
      request('Desactivar categoria', 'POST', '/api/categories/delete?chat_id={{chat_id}}', {
        body: {
          key: '{{category}}',
        },
      }),
      request('Listar reglas', 'GET', '/api/rules?chat_id={{chat_id}}'),
      request('Clasificar texto (admin)', 'POST', '/api/rules/classify', {
        admin: true,
        body: {
          chat_id: '{{chat_id}}',
          description: 'Compra en Plaza Vea',
          category: 'otro',
        },
      }),
      request('Guardar regla categoria', 'POST', '/api/rules/category?chat_id={{chat_id}}', {
        body: {
          chat_id: '{{chat_id}}',
          pattern: 'plaza vea',
          category: 'supermercado',
          priority: 100,
        },
      }),
      request('Eliminar regla categoria', 'POST', '/api/rules/category/delete?chat_id={{chat_id}}', {
        body: {
          chat_id: '{{chat_id}}',
          pattern: 'plaza vea',
        },
      }),
      request('Guardar regla presupuesto', 'POST', '/api/rules/budget?chat_id={{chat_id}}', {
        body: {
          chat_id: '{{chat_id}}',
          budgetCategory: 'supermercado',
          includedCategory: 'comida',
        },
      }),
      request('Eliminar regla presupuesto', 'POST', '/api/rules/budget/delete?chat_id={{chat_id}}', {
        body: {
          chat_id: '{{chat_id}}',
          budgetCategory: 'supermercado',
          includedCategory: 'comida',
        },
      }),
    ]),

    folder('06 Sync y Apps Script', [
      request('Sincronizar Sheets a D1', 'POST', '/api/sync?chat_id={{chat_id}}&limit={{limit}}'),
      request('Sincronizar GAS directo', 'POST', '/api/sync/gas?chat_id={{chat_id}}&limit={{limit}}'),
      request('Configurar triggers Apps Script', 'POST', '/api/apps-script/setup-triggers'),
      request('Enviar email diario', 'POST', '/api/apps-script/send-daily-email'),
      request('Enviar email mensual', 'POST', '/api/apps-script/send-monthly-email?month={{month_key}}'),
      request('Enviar email anual', 'POST', '/api/apps-script/send-yearly-email?year={{year}}'),
      request('Enviar Telegram diario', 'POST', '/api/apps-script/send-daily-telegram?chat_id={{chat_id}}'),
      request('Estado del sistema', 'GET', '/api/system-health'),
      request('Usuarios dashboard', 'GET', '/api/users'),
      request('Vincular usuario Telegram (admin)', 'POST', '/api/users/link', {
        admin: true,
        body: {
          email: '{{login_email}}',
          chat_id: '{{chat_id}}',
          label: 'Principal',
          role: 'admin',
        },
      }),
    ]),

    folder('07 Recibos', [
      request('Subir recibo (admin)', 'POST', '/api/receipts', {
        admin: true,
        body: {
          chat_id: '{{chat_id}}',
          transaction_id: '{{transaction_id}}',
          file_name: 'recibo-postman.jpg',
          content_type: 'image/jpeg',
          base64: '{{receipt_base64}}',
        },
        tests: saveVar('receipt_id', 'receipt.id'),
      }),
      request('Descargar archivo de recibo', 'GET', '/api/receipts/{{receipt_id}}/file'),
    ]),
  ],
};

const environment = {
  name: 'Finanzas Mayeson - Produccion',
  values: [
    variable('base_url', 'https://finanzas-d1-api.mayersonm.workers.dev'),
    variable('auth_token', ''),
    variable('session_token', ''),
    variable('dashboard_api_key', ''),
    variable('admin_key', ''),
    variable('login_email', 'mayersonm@gmail.com'),
    variable('login_password', ''),
    variable('new_password', ''),
    variable('chat_id', ''),
    variable('limit', '500'),
    variable('search', ''),
    variable('category', 'supermercado'),
    variable('transaction_id', ''),
    variable('fixed_id', ''),
    variable('debt_id', ''),
    variable('investment_id', ''),
    variable('receipt_id', ''),
    variable('receipt_base64', ''),
    variable('today', new Date().toISOString().slice(0, 10)),
    variable('calendar_month', new Date().toISOString().slice(0, 7)),
    variable('month_key', new Date().toISOString().slice(0, 7)),
    variable('cycle_start', ''),
    variable('payment_due_date', ''),
    variable('card_name', 'BCP'),
    variable('year', String(new Date().getFullYear())),
  ],
};

await mkdir(root, { recursive: true });
await writeFile(
  join(root, 'Finanzas_Mayeson.postman_collection.json'),
  `${JSON.stringify(collection, null, 2)}\n`,
);
await writeFile(
  join(root, 'Finanzas_Mayeson.postman_environment.json'),
  `${JSON.stringify(environment, null, 2)}\n`,
);

function folder(name, item) {
  return { name, item };
}

function request(name, method, path, options = {}) {
  const req = {
    name,
    request: {
      method,
      header: headers(options),
      url: `{{base_url}}${path}`,
    },
  };

  if (options.auth === 'noauth') {
    req.request.auth = { type: 'noauth' };
  }

  if (options.body) {
    req.request.body = {
      mode: 'raw',
      raw: JSON.stringify(options.body, null, 2),
      options: { raw: { language: 'json' } },
    };
  }

  if (options.tests) {
    req.event = [{
      listen: 'test',
      script: { type: 'text/javascript', exec: options.tests },
    }];
  }

  return req;
}

function headers(options = {}) {
  const result = [];
  if (options.body) {
    result.push({ key: 'Content-Type', value: 'application/json' });
  }
  if (options.admin) {
    result.push({ key: 'x-admin-key', value: '{{admin_key}}' });
  }
  return result;
}

function saveVar(variableName, jsonPath) {
  return [
    'const data = pm.response.json();',
    `const value = get(data, '${jsonPath}');`,
    'if (value) {',
    `  pm.environment.set('${variableName}', value);`,
    '}',
    'function get(obj, path) {',
    "  return path.split('.').reduce((acc, key) => acc && acc[key], obj);",
    '}',
  ];
}

function variable(key, value) {
  return { key, value, type: 'default', enabled: true };
}
