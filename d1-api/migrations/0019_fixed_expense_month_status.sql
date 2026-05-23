CREATE TABLE IF NOT EXISTS fixed_expense_month_status (
  id TEXT PRIMARY KEY,
  fixed_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  month_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pagado', 'saltado')),
  paid_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (fixed_id, chat_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_fixed_expense_month_status_lookup
  ON fixed_expense_month_status (chat_id, month_key, fixed_id);
