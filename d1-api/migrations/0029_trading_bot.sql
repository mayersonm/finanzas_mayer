CREATE TABLE IF NOT EXISTS trading_strategies (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'paper',
  symbols TEXT NOT NULL DEFAULT 'BTC,ETH,SOL',
  base_currency TEXT NOT NULL DEFAULT 'USDT',
  allocation_usd REAL NOT NULL DEFAULT 10,
  max_daily_loss_usd REAL NOT NULL DEFAULT 5,
  max_trades_per_day INTEGER NOT NULL DEFAULT 2,
  buy_drop_pct REAL NOT NULL DEFAULT 3,
  take_profit_pct REAL NOT NULL DEFAULT 3,
  stop_loss_pct REAL NOT NULL DEFAULT 1.5,
  trailing_stop_pct REAL NOT NULL DEFAULT 1.2,
  rsi_buy_below REAL NOT NULL DEFAULT 35,
  cooldown_minutes INTEGER NOT NULL DEFAULT 240,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chat_id, name)
);

CREATE INDEX IF NOT EXISTS idx_trading_strategies_chat_active
  ON trading_strategies (chat_id, active, updated_at);

CREATE TABLE IF NOT EXISTS trading_signals (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'watch',
  mode TEXT NOT NULL DEFAULT 'paper',
  signal_price_usd REAL NOT NULL DEFAULT 0,
  quantity REAL NOT NULL DEFAULT 0,
  notional_usd REAL NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  reason TEXT,
  take_profit_price_usd REAL NOT NULL DEFAULT 0,
  stop_loss_price_usd REAL NOT NULL DEFAULT 0,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trading_signals_chat_created
  ON trading_signals (chat_id, created_at);

CREATE INDEX IF NOT EXISTS idx_trading_signals_strategy_symbol
  ON trading_signals (strategy_id, symbol, side, status, created_at);

CREATE TABLE IF NOT EXISTS trading_orders (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  signal_id TEXT,
  strategy_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'paper',
  status TEXT NOT NULL DEFAULT 'open',
  price_usd REAL NOT NULL DEFAULT 0,
  quantity REAL NOT NULL DEFAULT 0,
  notional_usd REAL NOT NULL DEFAULT 0,
  fee_usd REAL NOT NULL DEFAULT 0,
  pnl_usd REAL NOT NULL DEFAULT 0,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT,
  close_price_usd REAL NOT NULL DEFAULT 0,
  reason TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trading_orders_chat_status
  ON trading_orders (chat_id, status, opened_at);

CREATE INDEX IF NOT EXISTS idx_trading_orders_strategy_symbol
  ON trading_orders (strategy_id, symbol, status, opened_at);
