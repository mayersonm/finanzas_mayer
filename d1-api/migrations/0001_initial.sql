CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  tx_date TEXT NOT NULL,
  tx_time TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ingreso', 'gasto')),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_chat_date
  ON transactions (chat_id, tx_date);

CREATE INDEX IF NOT EXISTS idx_transactions_chat_type
  ON transactions (chat_id, type);

CREATE INDEX IF NOT EXISTS idx_transactions_chat_category
  ON transactions (chat_id, category);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  category TEXT NOT NULL,
  limit_amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (chat_id, category)
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  saved_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (chat_id, name)
);

CREATE TABLE IF NOT EXISTS fixed_expenses (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (chat_id, name)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
