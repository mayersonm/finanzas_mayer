CREATE TABLE IF NOT EXISTS crypto_operations (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  asset_name TEXT,
  type TEXT NOT NULL DEFAULT 'buy',
  quantity REAL NOT NULL DEFAULT 0,
  unit_price_usd REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  operation_date TEXT NOT NULL,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crypto_operations_chat_active
  ON crypto_operations (chat_id, active, operation_date);

CREATE INDEX IF NOT EXISTS idx_crypto_operations_symbol
  ON crypto_operations (symbol);

CREATE TABLE IF NOT EXISTS crypto_price_cache (
  symbol TEXT PRIMARY KEY,
  asset_id TEXT,
  name TEXT,
  price_usd REAL NOT NULL DEFAULT 0,
  change_24h REAL NOT NULL DEFAULT 0,
  market_cap_usd REAL NOT NULL DEFAULT 0,
  volume_24h_usd REAL NOT NULL DEFAULT 0,
  source TEXT,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crypto_alerts (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT 'below',
  target_price_usd REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  last_triggered_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crypto_alerts_chat_active
  ON crypto_alerts (chat_id, active, symbol);
