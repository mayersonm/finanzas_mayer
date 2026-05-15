ALTER TABLE transactions ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'debito';
ALTER TABLE transactions ADD COLUMN payment_due_date TEXT;
ALTER TABLE transactions ADD COLUMN card_name TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_payment_due
  ON transactions (chat_id, payment_method, payment_due_date);
