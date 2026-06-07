ALTER TABLE financial_closures ADD COLUMN status TEXT NOT NULL DEFAULT 'closed';
ALTER TABLE financial_closures ADD COLUMN closed_at TEXT;
ALTER TABLE financial_closures ADD COLUMN next_cycle_key TEXT;
ALTER TABLE financial_closures ADD COLUMN next_cycle_start TEXT;
ALTER TABLE financial_closures ADD COLUMN next_cycle_end TEXT;
ALTER TABLE financial_closures ADD COLUMN next_close_date TEXT;
ALTER TABLE financial_closures ADD COLUMN suggested_savings REAL NOT NULL DEFAULT 0;
ALTER TABLE financial_closures ADD COLUMN savings_action TEXT NOT NULL DEFAULT 'suggested';
ALTER TABLE financial_closures ADD COLUMN next_budget_json TEXT;
