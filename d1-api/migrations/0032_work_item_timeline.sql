CREATE TABLE IF NOT EXISTS work_item_timeline (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'note',
  message TEXT NOT NULL,
  event_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_item_timeline_item_date
  ON work_item_timeline (chat_id, work_item_id, event_date, created_at);

CREATE INDEX IF NOT EXISTS idx_work_item_timeline_chat_created
  ON work_item_timeline (chat_id, created_at);
