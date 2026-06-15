CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  blockers TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TEXT,
  tags TEXT,
  sort_order REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_items_chat_active_status
  ON work_items (chat_id, active, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_work_items_chat_updated
  ON work_items (chat_id, updated_at);
