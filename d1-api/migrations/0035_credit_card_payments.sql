CREATE TABLE IF NOT EXISTS credit_card_payments (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  card_name TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PEN',
  payment_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_card_payments_chat
  ON credit_card_payments (chat_id, payment_date DESC);
