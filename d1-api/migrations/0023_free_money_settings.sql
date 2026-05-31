ALTER TABLE user_settings ADD COLUMN savings_target_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN emergency_buffer_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN investor_profile TEXT NOT NULL DEFAULT 'conservador';
ALTER TABLE user_settings ADD COLUMN investment_horizon TEXT NOT NULL DEFAULT 'corto';
