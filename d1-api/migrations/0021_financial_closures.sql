CREATE TABLE IF NOT EXISTS financial_closures (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  closure_key TEXT NOT NULL,
  close_date TEXT NOT NULL,
  label TEXT NOT NULL,
  month_key TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  ingresos REAL NOT NULL DEFAULT 0,
  gastos REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  fijos_pagados REAL NOT NULL DEFAULT 0,
  fijos_pendientes REAL NOT NULL DEFAULT 0,
  deudas_pendientes REAL NOT NULL DEFAULT 0,
  presupuesto_limite REAL NOT NULL DEFAULT 0,
  presupuesto_usado REAL NOT NULL DEFAULT 0,
  presupuesto_restante REAL NOT NULL DEFAULT 0,
  presupuesto_excedido REAL NOT NULL DEFAULT 0,
  pendiente_comprometido REAL NOT NULL DEFAULT 0,
  que_queda REAL NOT NULL DEFAULT 0,
  patrimonio_disponible REAL NOT NULL DEFAULT 0,
  movimientos INTEGER NOT NULL DEFAULT 0,
  top_fugas_json TEXT,
  details_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (chat_id, closure_key)
);

CREATE INDEX IF NOT EXISTS idx_financial_closures_chat_key
  ON financial_closures (chat_id, closure_key DESC);
