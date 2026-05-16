CREATE TABLE IF NOT EXISTS category_rules (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL DEFAULT '*',
  keyword TEXT NOT NULL,
  category TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_category_rules_chat_keyword
  ON category_rules (chat_id, keyword);

CREATE INDEX IF NOT EXISTS idx_category_rules_lookup
  ON category_rules (chat_id, active, priority);

CREATE TABLE IF NOT EXISTS budget_category_rules (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL DEFAULT '*',
  budget_category TEXT NOT NULL,
  included_category TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_category_rules_pair
  ON budget_category_rules (chat_id, budget_category, included_category);

INSERT OR IGNORE INTO category_rules (id, chat_id, keyword, category, priority, notes) VALUES
  ('cat:*:plaza-vea', '*', 'plaza vea', 'supermercado', 120, 'Supermercado'),
  ('cat:*:supermercado', '*', 'supermercado', 'supermercado', 110, 'Categoria directa'),
  ('cat:*:mercado', '*', 'mercado', 'supermercado', 100, 'Supermercado'),
  ('cat:*:wong', '*', 'wong', 'supermercado', 110, 'Supermercado'),
  ('cat:*:metro', '*', 'metro', 'supermercado', 110, 'Supermercado'),
  ('cat:*:tottus', '*', 'tottus', 'supermercado', 110, 'Supermercado'),
  ('cat:*:makro', '*', 'makro', 'supermercado', 110, 'Supermercado'),
  ('cat:*:vivanda', '*', 'vivanda', 'supermercado', 110, 'Supermercado'),

  ('cat:*:kfc', '*', 'kfc', 'entretenimiento', 140, 'Comida rapida'),
  ('cat:*:popeyes', '*', 'popeyes', 'entretenimiento', 140, 'Comida rapida'),
  ('cat:*:bembos', '*', 'bembos', 'entretenimiento', 140, 'Comida rapida'),
  ('cat:*:mcdonalds', '*', 'mcdonalds', 'entretenimiento', 140, 'Comida rapida'),
  ('cat:*:mc-donald', '*', 'mc donald', 'entretenimiento', 140, 'Comida rapida'),
  ('cat:*:burger-king', '*', 'burger king', 'entretenimiento', 140, 'Comida rapida'),
  ('cat:*:pizza-hut', '*', 'pizza hut', 'entretenimiento', 140, 'Comida rapida'),
  ('cat:*:dominos', '*', 'dominos', 'entretenimiento', 140, 'Comida rapida'),
  ('cat:*:papa-john', '*', 'papa john', 'entretenimiento', 140, 'Comida rapida'),
  ('cat:*:comida-rapida', '*', 'comida rapida', 'entretenimiento', 140, 'Comida rapida'),
  ('cat:*:fast-food', '*', 'fast food', 'entretenimiento', 140, 'Comida rapida'),
  ('cat:*:hamburguesa', '*', 'hamburguesa', 'entretenimiento', 120, 'Comida rapida'),
  ('cat:*:salchipapa', '*', 'salchipapa', 'entretenimiento', 120, 'Comida rapida'),
  ('cat:*:cine', '*', 'cine', 'entretenimiento', 100, 'Entretenimiento'),
  ('cat:*:netflix', '*', 'netflix', 'entretenimiento', 100, 'Entretenimiento'),
  ('cat:*:spotify', '*', 'spotify', 'entretenimiento', 100, 'Entretenimiento'),
  ('cat:*:steam', '*', 'steam', 'entretenimiento', 100, 'Entretenimiento'),
  ('cat:*:disney', '*', 'disney', 'entretenimiento', 100, 'Entretenimiento'),

  ('cat:*:gasolina', '*', 'gasolina', 'transporte', 140, 'Auto'),
  ('cat:*:combustible', '*', 'combustible', 'transporte', 140, 'Auto'),
  ('cat:*:gas-al-carro', '*', 'gas al carro', 'transporte', 150, 'Auto'),
  ('cat:*:gas-para-carro', '*', 'gas para carro', 'transporte', 150, 'Auto'),
  ('cat:*:gnv', '*', 'gnv', 'transporte', 140, 'Auto'),
  ('cat:*:glp', '*', 'glp', 'transporte', 140, 'Auto'),
  ('cat:*:grifo', '*', 'grifo', 'transporte', 130, 'Auto'),
  ('cat:*:primax', '*', 'primax', 'transporte', 130, 'Auto'),
  ('cat:*:repsol', '*', 'repsol', 'transporte', 130, 'Auto'),
  ('cat:*:pecsa', '*', 'pecsa', 'transporte', 130, 'Auto'),
  ('cat:*:petroperu', '*', 'petroperu', 'transporte', 130, 'Auto'),
  ('cat:*:taxi', '*', 'taxi', 'transporte', 100, 'Transporte'),
  ('cat:*:uber', '*', 'uber', 'transporte', 100, 'Transporte'),
  ('cat:*:didi', '*', 'didi', 'transporte', 100, 'Transporte'),
  ('cat:*:indrive', '*', 'indrive', 'transporte', 100, 'Transporte'),
  ('cat:*:peaje', '*', 'peaje', 'transporte', 100, 'Transporte'),
  ('cat:*:estacionamiento', '*', 'estacionamiento', 'transporte', 100, 'Transporte'),
  ('cat:*:carro', '*', 'carro', 'transporte', 90, 'Transporte'),

  ('cat:*:recibo-de-gas', '*', 'recibo de gas', 'servicios', 160, 'Servicio hogar'),
  ('cat:*:servicio-de-gas', '*', 'servicio de gas', 'servicios', 160, 'Servicio hogar'),
  ('cat:*:gas-natural', '*', 'gas natural', 'servicios', 160, 'Servicio hogar'),
  ('cat:*:calidda', '*', 'calidda', 'servicios', 160, 'Servicio hogar'),
  ('cat:*:internet', '*', 'internet', 'servicios', 100, 'Servicio'),
  ('cat:*:alquiler', '*', 'alquiler', 'servicios', 100, 'Servicio'),
  ('cat:*:renta', '*', 'renta', 'servicios', 100, 'Servicio'),
  ('cat:*:luz', '*', 'luz', 'servicios', 100, 'Servicio'),
  ('cat:*:agua', '*', 'agua', 'servicios', 100, 'Servicio'),
  ('cat:*:telefono', '*', 'telefono', 'servicios', 100, 'Servicio'),
  ('cat:*:celular', '*', 'celular', 'servicios', 100, 'Servicio'),

  ('cat:*:alimentacion', '*', 'alimentacion', 'comida', 100, 'Comida'),
  ('cat:*:almuerzo', '*', 'almuerzo', 'comida', 100, 'Comida'),
  ('cat:*:cena', '*', 'cena', 'comida', 100, 'Comida'),
  ('cat:*:desayuno', '*', 'desayuno', 'comida', 100, 'Comida'),
  ('cat:*:cafe', '*', 'cafe', 'comida', 100, 'Comida'),
  ('cat:*:restaurante', '*', 'restaurante', 'comida', 100, 'Comida'),
  ('cat:*:restaurant', '*', 'restaurant', 'comida', 100, 'Comida'),
  ('cat:*:pollo', '*', 'pollo', 'comida', 80, 'Comida'),
  ('cat:*:leche', '*', 'leche', 'comida', 80, 'Comida'),
  ('cat:*:yogurt', '*', 'yogurt', 'comida', 80, 'Comida'),

  ('cat:*:farmacia', '*', 'farmacia', 'salud', 100, 'Salud'),
  ('cat:*:medicina', '*', 'medicina', 'salud', 100, 'Salud'),
  ('cat:*:doctor', '*', 'doctor', 'salud', 100, 'Salud'),
  ('cat:*:clinica', '*', 'clinica', 'salud', 100, 'Salud'),
  ('cat:*:medico', '*', 'medico', 'salud', 100, 'Salud'),

  ('cat:*:zapatilla', '*', 'zapatilla', 'ropa', 100, 'Ropa'),
  ('cat:*:zapato', '*', 'zapato', 'ropa', 100, 'Ropa'),
  ('cat:*:camisa', '*', 'camisa', 'ropa', 100, 'Ropa'),
  ('cat:*:polo', '*', 'polo', 'ropa', 100, 'Ropa'),
  ('cat:*:pantalon', '*', 'pantalon', 'ropa', 100, 'Ropa'),

  ('cat:*:curso', '*', 'curso', 'educacion', 100, 'Educacion'),
  ('cat:*:libro', '*', 'libro', 'educacion', 100, 'Educacion'),
  ('cat:*:universidad', '*', 'universidad', 'educacion', 100, 'Educacion'),
  ('cat:*:clase', '*', 'clase', 'educacion', 100, 'Educacion');

INSERT OR IGNORE INTO budget_category_rules (id, chat_id, budget_category, included_category, notes) VALUES
  ('budget:*:comida:supermercado', '*', 'comida', 'supermercado', 'Todo supermercado cuenta dentro del presupuesto de comida');
