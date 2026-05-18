CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'otro',
  amount REAL NOT NULL DEFAULT 0,
  current_value REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PEN',
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (chat_id, name)
);

CREATE INDEX IF NOT EXISTS idx_investments_chat_active
  ON investments (chat_id, active);
