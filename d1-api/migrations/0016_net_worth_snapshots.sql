CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  assets_total REAL NOT NULL DEFAULT 0,
  liabilities_total REAL NOT NULL DEFAULT 0,
  net_worth REAL NOT NULL DEFAULT 0,
  exchange_rate REAL NOT NULL DEFAULT 3.85,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (chat_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_chat_date
  ON net_worth_snapshots (chat_id, snapshot_date DESC);
