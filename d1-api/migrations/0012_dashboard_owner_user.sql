UPDATE users
SET email = NULL,
    active = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE lower(email) = 'mayersonm@gmail.com'
  AND role <> 'admin';

UPDATE users
SET email = 'mayersonm@gmail.com',
    name = CASE WHEN name IS NULL OR name = '' OR name = 'Principal' THEN 'Mayerson Medina' ELSE name END,
    role = 'admin',
    active = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE role = 'admin';
