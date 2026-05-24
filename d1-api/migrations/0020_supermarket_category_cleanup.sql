UPDATE category_rules
SET category = 'supermercado',
    notes = 'Supermercado',
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'comida';

UPDATE transactions
SET category = 'supermercado',
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'comida';

UPDATE receipts
SET category = 'supermercado',
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'comida';

UPDATE fixed_expenses
SET category = 'supermercado',
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'comida';

UPDATE budgets
SET limit_amount = (
      SELECT MAX(b2.limit_amount)
      FROM budgets b2
      WHERE b2.chat_id = budgets.chat_id
        AND b2.category IN ('comida', 'supermercado')
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'supermercado'
  AND EXISTS (
    SELECT 1
    FROM budgets b2
    WHERE b2.chat_id = budgets.chat_id
      AND b2.category = 'comida'
  );

UPDATE budgets
SET category = 'supermercado',
    id = 'budget:' || chat_id || ':supermercado',
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'comida'
  AND NOT EXISTS (
    SELECT 1
    FROM budgets b2
    WHERE b2.chat_id = budgets.chat_id
      AND b2.category = 'supermercado'
  );

DELETE FROM budgets
WHERE category = 'comida';

DELETE FROM budget_category_rules
WHERE budget_category = 'comida'
   OR included_category = 'comida'
   OR budget_category = included_category;

UPDATE category_definitions
SET active = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'comida';
