INSERT INTO category_rules (id, chat_id, keyword, category, priority, notes)
VALUES
  ('cat:*:comida', '*', 'comida', 'supermercado', 115, 'Comida general cuenta como supermercado'),
  ('cat:*:alimentos', '*', 'alimentos', 'supermercado', 115, 'Alimentos cuentan como supermercado'),
  ('cat:*:abarrotes', '*', 'abarrotes', 'supermercado', 115, 'Abarrotes cuentan como supermercado'),
  ('cat:*:supermercados', '*', 'supermercados', 'supermercado', 110, 'Categoria directa')
ON CONFLICT(chat_id, keyword) DO UPDATE SET
  category = excluded.category,
  priority = CASE
    WHEN category_rules.priority > excluded.priority THEN category_rules.priority
    ELSE excluded.priority
  END,
  active = 1,
  notes = excluded.notes,
  updated_at = CURRENT_TIMESTAMP;

UPDATE transactions
SET category = 'supermercado',
    updated_at = CURRENT_TIMESTAMP
WHERE type = 'gasto'
  AND lower(category) NOT IN ('entretenimiento', 'deudas')
  AND (
    lower(category) IN ('comida', 'alimentacion', 'alimentos', 'abarrotes', 'mercado', 'supermercados')
    OR lower(category) LIKE '%supermercado%'
    OR lower(description) LIKE '%supermercado%'
    OR lower(description) LIKE '%comida%'
  )
  AND lower(description) NOT LIKE '%comida r%'
  AND lower(description) NOT LIKE '%fast food%'
  AND lower(description) NOT LIKE '%kfc%'
  AND lower(description) NOT LIKE '%popeyes%'
  AND lower(description) NOT LIKE '%bembos%'
  AND lower(description) NOT LIKE '%mcdonald%'
  AND lower(description) NOT LIKE '%burger king%'
  AND lower(description) NOT LIKE '%pizza hut%'
  AND lower(description) NOT LIKE '%dominos%'
  AND lower(description) NOT LIKE '%papa john%';

UPDATE receipts
SET category = 'supermercado',
    updated_at = CURRENT_TIMESTAMP
WHERE lower(category) NOT IN ('entretenimiento', 'deudas')
  AND (
    lower(category) IN ('comida', 'alimentacion', 'alimentos', 'abarrotes', 'mercado', 'supermercados')
    OR lower(category) LIKE '%supermercado%'
  );

UPDATE fixed_expenses
SET category = 'supermercado',
    updated_at = CURRENT_TIMESTAMP
WHERE lower(category) IN ('comida', 'alimentacion', 'alimentos', 'abarrotes', 'mercado', 'supermercados')
   OR lower(category) LIKE '%supermercado%';

UPDATE budgets
SET limit_amount = (
      SELECT MAX(b2.limit_amount)
      FROM budgets b2
      WHERE b2.chat_id = budgets.chat_id
        AND lower(b2.category) IN ('supermercado', 'comida', 'alimentacion', 'alimentos', 'abarrotes', 'mercado', 'supermercados')
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'supermercado'
  AND EXISTS (
    SELECT 1
    FROM budgets b2
    WHERE b2.chat_id = budgets.chat_id
      AND lower(b2.category) IN ('comida', 'alimentacion', 'alimentos', 'abarrotes', 'mercado', 'supermercados')
  );

UPDATE budgets
SET category = 'supermercado',
    id = 'budget:' || chat_id || ':supermercado',
    updated_at = CURRENT_TIMESTAMP
WHERE lower(category) IN ('comida', 'alimentacion', 'alimentos', 'abarrotes', 'mercado', 'supermercados')
  AND NOT EXISTS (
    SELECT 1
    FROM budgets b2
    WHERE b2.chat_id = budgets.chat_id
      AND b2.category = 'supermercado'
  );

DELETE FROM budgets
WHERE lower(category) IN ('comida', 'alimentacion', 'alimentos', 'abarrotes', 'mercado', 'supermercados');

DELETE FROM budget_category_rules
WHERE lower(budget_category) IN ('comida', 'alimentacion', 'alimentos', 'abarrotes', 'mercado', 'supermercados')
   OR lower(included_category) IN ('comida', 'alimentacion', 'alimentos', 'abarrotes', 'mercado', 'supermercados')
   OR budget_category = included_category;

UPDATE category_definitions
SET active = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE lower(category) IN ('comida', 'alimentacion', 'alimentos', 'abarrotes', 'mercado', 'supermercados');
