CREATE TABLE IF NOT EXISTS work_meetings (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  title TEXT NOT NULL,
  meeting_date TEXT NOT NULL,
  start_time TEXT,
  participants TEXT,
  agenda TEXT,
  notes TEXT,
  outcome TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  tags TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_followups (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  meeting_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  person TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_meetings_chat_date
  ON work_meetings (chat_id, active, meeting_date);

CREATE INDEX IF NOT EXISTS idx_work_followups_chat_status
  ON work_followups (chat_id, active, status, due_date);

CREATE INDEX IF NOT EXISTS idx_work_followups_meeting
  ON work_followups (chat_id, meeting_id, active);
