ALTER TABLE user_settings ADD COLUMN email_finance TEXT NOT NULL DEFAULT '';
ALTER TABLE user_settings ADD COLUMN claude_model TEXT NOT NULL DEFAULT '';
ALTER TABLE user_settings ADD COLUMN claude_api_url TEXT NOT NULL DEFAULT '';
