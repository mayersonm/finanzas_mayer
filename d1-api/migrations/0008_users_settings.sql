CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  google_sub TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users (email)
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
  ON users (google_sub)
  WHERE google_sub IS NOT NULL AND google_sub <> '';

CREATE TABLE IF NOT EXISTS user_chat_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  label TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (chat_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_chat_links_user
  ON user_chat_links (user_id, active);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  credit_cutoff_day INTEGER NOT NULL DEFAULT 25,
  credit_due_day INTEGER NOT NULL DEFAULT 10,
  credit_card_name TEXT NOT NULL DEFAULT '',
  default_currency TEXT NOT NULL DEFAULT 'PEN' CHECK (default_currency IN ('PEN', 'USD')),
  default_payment_method TEXT NOT NULL DEFAULT 'debito' CHECK (default_payment_method IN ('debito', 'credito')),
  receipt_image_max_bytes INTEGER NOT NULL DEFAULT 921600,
  email_daily TEXT NOT NULL DEFAULT '',
  email_monthly TEXT NOT NULL DEFAULT '',
  email_yearly TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS category_definitions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '*',
  category TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'gasto' CHECK (type IN ('gasto', 'ingreso')),
  color TEXT NOT NULL DEFAULT '#6b7280',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, category, type)
);

INSERT OR IGNORE INTO category_definitions (id, user_id, category, type, color, sort_order) VALUES
  ('catdef:*:gasto:comida', '*', 'comida', 'gasto', '#22c55e', 10),
  ('catdef:*:gasto:supermercado', '*', 'supermercado', 'gasto', '#84cc16', 20),
  ('catdef:*:gasto:transporte', '*', 'transporte', 'gasto', '#3b82f6', 30),
  ('catdef:*:gasto:servicios', '*', 'servicios', 'gasto', '#f59e0b', 40),
  ('catdef:*:gasto:entretenimiento', '*', 'entretenimiento', 'gasto', '#ec4899', 50),
  ('catdef:*:gasto:salud', '*', 'salud', 'gasto', '#8b5cf6', 60),
  ('catdef:*:gasto:ropa', '*', 'ropa', 'gasto', '#14b8a6', 70),
  ('catdef:*:gasto:educacion', '*', 'educacion', 'gasto', '#f97316', 80),
  ('catdef:*:gasto:otro', '*', 'otro', 'gasto', '#6b7280', 999),
  ('catdef:*:ingreso:salario', '*', 'salario', 'ingreso', '#06b6d4', 10),
  ('catdef:*:ingreso:freelance', '*', 'freelance', 'ingreso', '#a855f7', 20),
  ('catdef:*:ingreso:inversion', '*', 'inversion', 'ingreso', '#22c55e', 30),
  ('catdef:*:ingreso:venta', '*', 'venta', 'ingreso', '#f59e0b', 40),
  ('catdef:*:ingreso:otro', '*', 'otro', 'ingreso', '#6b7280', 999);
