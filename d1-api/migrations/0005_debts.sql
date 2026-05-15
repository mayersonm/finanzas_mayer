CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  name TEXT NOT NULL,
  total_amount REAL NOT NULL,
  paid_amount REAL NOT NULL DEFAULT 0,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'activa',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (chat_id, name)
);

CREATE INDEX IF NOT EXISTS idx_debts_chat_status
  ON debts (chat_id, status);

CREATE INDEX IF NOT EXISTS idx_debts_chat_due
  ON debts (chat_id, due_date);
