ALTER TABLE transactions ADD COLUMN installment_group_id TEXT;
ALTER TABLE transactions ADD COLUMN installment_index INTEGER;
ALTER TABLE transactions ADD COLUMN installment_total INTEGER;

CREATE INDEX IF NOT EXISTS idx_transactions_installment_group
  ON transactions (chat_id, installment_group_id);

ALTER TABLE user_settings ADD COLUMN credit_card_limit REAL NOT NULL DEFAULT 1500;
