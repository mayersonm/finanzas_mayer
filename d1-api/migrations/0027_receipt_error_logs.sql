CREATE TABLE IF NOT EXISTS receipt_error_logs (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL DEFAULT '',
  transaction_id TEXT NOT NULL DEFAULT '',
  receipt_id TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_receipt_error_logs_chat_created
  ON receipt_error_logs (chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_receipt_error_logs_transaction
  ON receipt_error_logs (transaction_id, created_at DESC);
