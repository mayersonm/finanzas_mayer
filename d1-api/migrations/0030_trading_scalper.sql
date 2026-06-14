ALTER TABLE trading_strategies ADD COLUMN scalper_ticks INTEGER NOT NULL DEFAULT 12;
ALTER TABLE trading_strategies ADD COLUMN scalper_take_profit_pct REAL NOT NULL DEFAULT 0.6;
ALTER TABLE trading_strategies ADD COLUMN scalper_stop_loss_pct REAL NOT NULL DEFAULT 0.4;
ALTER TABLE trading_strategies ADD COLUMN scalper_fee_pct REAL NOT NULL DEFAULT 0.1;
ALTER TABLE trading_strategies ADD COLUMN scalper_spread_pct REAL NOT NULL DEFAULT 0.05;
ALTER TABLE trading_strategies ADD COLUMN scalper_max_round_trips INTEGER NOT NULL DEFAULT 6;

CREATE TABLE IF NOT EXISTS trading_scalper_runs (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  symbols TEXT NOT NULL,
  ticks INTEGER NOT NULL DEFAULT 0,
  opened_orders INTEGER NOT NULL DEFAULT 0,
  closed_orders INTEGER NOT NULL DEFAULT 0,
  gross_pnl_usd REAL NOT NULL DEFAULT 0,
  fees_usd REAL NOT NULL DEFAULT 0,
  net_pnl_usd REAL NOT NULL DEFAULT 0,
  best_trade_usd REAL NOT NULL DEFAULT 0,
  worst_trade_usd REAL NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trading_scalper_runs_chat_created
  ON trading_scalper_runs (chat_id, created_at);
