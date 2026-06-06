INSERT INTO category_rules (id, chat_id, keyword, category, priority, notes)
VALUES
  ('cat:*:soat', '*', 'soat', 'transporte', 155, 'Seguro vehicular'),
  ('cat:*:seguro-vehicular', '*', 'seguro vehicular', 'transporte', 145, 'Seguro vehicular'),
  ('cat:*:vehicular', '*', 'vehicular', 'transporte', 120, 'Gasto vehicular'),
  ('cat:*:auto', '*', 'auto', 'transporte', 95, 'Gasto de auto'),
  ('cat:*:entrenamiento', '*', 'entrenamiento', 'salud', 120, 'Actividad fisica'),
  ('cat:*:gimnasio', '*', 'gimnasio', 'salud', 120, 'Actividad fisica'),
  ('cat:*:piscina', '*', 'piscina', 'salud', 105, 'Actividad fisica')
ON CONFLICT(chat_id, keyword) DO UPDATE SET
  category = excluded.category,
  priority = CASE
    WHEN category_rules.priority > excluded.priority THEN category_rules.priority
    ELSE excluded.priority
  END,
  active = 1,
  notes = excluded.notes,
  updated_at = CURRENT_TIMESTAMP;
