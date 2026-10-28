-- ==============================================================================
-- SVP Sentinel Core — Provision Employee & Administrator Demo Accounts
-- Migration: 20261029000001_provision_demo_accounts.sql
-- Description: Idempotently provisions separate demo.employee and demo.admin
--              accounts with verified password hashes and database-backed roles.
-- ==============================================================================

-- 1. Ensure demo.employee exists with 'employee' role and active status
INSERT INTO public.users (
  sqlite_id,
  username,
  password,
  role,
  email,
  first_name,
  last_name,
  is_active,
  date_joined,
  created_at
) VALUES (
  2,
  'demo.employee',
  '$2a$10$YJPKOfhL/kcFVOMM3a89LewQ8rug25VAsH/t2B6UYcC4d6ADtHXz2',
  'employee',
  'demo.employee@sentinel.internal',
  'Demo',
  'Employee',
  TRUE,
  '2026-04-03T13:21:43.610Z',
  NOW()
)
ON CONFLICT (username) DO UPDATE SET
  role = 'employee',
  is_active = TRUE,
  password = EXCLUDED.password;

-- 2. Ensure demo.admin exists with 'admin' role and active status
INSERT INTO public.users (
  sqlite_id,
  username,
  password,
  role,
  email,
  first_name,
  last_name,
  is_active,
  date_joined,
  created_at
) VALUES (
  12,
  'demo.admin',
  '$2b$10$S8INWOeZGnkR8P8cGlaXS.rxYcckT3dTaDbbJinI1tW0wXUd3FKx2',
  'admin',
  'demo.admin@sentinel.internal',
  'Demo',
  'Administrator',
  TRUE,
  '2026-10-29T00:00:00.000Z',
  NOW()
)
ON CONFLICT (username) DO UPDATE SET
  role = 'admin',
  is_active = TRUE,
  password = EXCLUDED.password;

SELECT setval(pg_get_serial_sequence('public.users', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.users));
