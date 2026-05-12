CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  storage TEXT NOT NULL DEFAULT 'd1',
  r2_key TEXT,
  image_base64 TEXT,
  file_name TEXT,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  telegram_file_id TEXT,
  telegram_file_path TEXT,
  tx_date TEXT,
  tx_time TEXT,
  type TEXT,
  description TEXT,
  category TEXT,
  amount REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_chat_created
  ON receipts (chat_id, created_at);

CREATE INDEX IF NOT EXISTS idx_receipts_transaction
  ON receipts (transaction_id);
