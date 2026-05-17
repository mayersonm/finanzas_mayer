CREATE TABLE IF NOT EXISTS user_google_tokens (
  user_id TEXT PRIMARY KEY,
  refresh_token_enc TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT '',
  token_type TEXT NOT NULL DEFAULT '',
  expires_at INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_installations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google',
  app_name TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL DEFAULT '',
  script_id TEXT NOT NULL DEFAULT '',
  deployment_id TEXT NOT NULL DEFAULT '',
  web_app_url TEXT NOT NULL DEFAULT '',
  install_secret_hash TEXT NOT NULL DEFAULT '',
  telegram_bot_token_enc TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_installations_user
  ON user_installations (user_id, provider, status);
