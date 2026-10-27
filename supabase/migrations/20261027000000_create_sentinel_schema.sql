-- ==============================================================================
-- SVP Sentinel Core / Policy Pilot Schema Migration
-- Migration: 20261027000000_create_sentinel_schema.sql
-- Description: Creates PostgreSQL schema, constraints, RLS policies, indexes,
--              and storage bucket setup for Supabase Edge Functions.
-- ==============================================================================

-- 1. Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Users table (preserves SQLite/Django & MongoDB fields and dual-hash support)
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  sqlite_id INTEGER UNIQUE,
  username VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) DEFAULT '',
  role VARCHAR(50) DEFAULT 'employee',
  email VARCHAR(254) DEFAULT '',
  first_name VARCHAR(150) DEFAULT '',
  last_name VARCHAR(150) DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  date_joined TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 3. Policies table
CREATE TABLE IF NOT EXISTS public.policies (
  id BIGSERIAL PRIMARY KEY,
  sqlite_id INTEGER UNIQUE,
  title VARCHAR(255) NOT NULL,
  document TEXT DEFAULT NULL,
  source_name VARCHAR(255) DEFAULT '',
  content_text TEXT DEFAULT '',
  uploaded_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_by_username VARCHAR(150) DEFAULT 'Unknown',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_policies_updated_at
  BEFORE UPDATE ON public.policies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 4. Rules table (Cascade deleted if policy is deleted)
CREATE TABLE IF NOT EXISTS public.rules (
  id BIGSERIAL PRIMARY KEY,
  sqlite_id INTEGER UNIQUE,
  policy_id BIGINT NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  description TEXT DEFAULT '',
  condition TEXT DEFAULT '',
  action TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_rules_updated_at
  BEFORE UPDATE ON public.rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 5. Logs table
CREATE TABLE IF NOT EXISTS public.logs (
  id BIGSERIAL PRIMARY KEY,
  sqlite_id INTEGER UNIQUE,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  username VARCHAR(150) DEFAULT 'Unknown',
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_logs_updated_at
  BEFORE UPDATE ON public.logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 6. Violations table (Cascade deleted if log is deleted)
CREATE TABLE IF NOT EXISTS public.violations (
  id BIGSERIAL PRIMARY KEY,
  sqlite_id INTEGER UNIQUE,
  log_id BIGINT NOT NULL REFERENCES public.logs(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_violations_updated_at
  BEFORE UPDATE ON public.violations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 7. High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON public.users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_policies_created_at ON public.policies (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policies_uploaded_by ON public.policies (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_rules_policy_id ON public.rules (policy_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON public.logs (user_id);
CREATE INDEX IF NOT EXISTS idx_violations_log_id ON public.violations (log_id);
CREATE INDEX IF NOT EXISTS idx_violations_created_at ON public.violations (created_at DESC);

-- 8. Row Level Security (RLS) Configuration
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;

-- Service role full access policies (Edge Functions use service role)
CREATE POLICY "service_role_all_users" ON public.users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_policies" ON public.policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_rules" ON public.rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_logs" ON public.logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_violations" ON public.violations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated and Anon read policies (for direct client queries if needed)
CREATE POLICY "allow_read_users_profile" ON public.users
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "allow_read_policies" ON public.policies
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "allow_read_rules" ON public.rules
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "allow_read_logs" ON public.logs
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "allow_read_violations" ON public.violations
  FOR SELECT TO authenticated, anon USING (true);

-- 9. Storage Bucket setup for policy documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('policies', 'policies', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow service_role and authenticated users to access policies bucket
CREATE POLICY "allow_service_role_policies_storage" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'policies')
  WITH CHECK (bucket_id = 'policies');

CREATE POLICY "allow_authenticated_read_policies_storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'policies');
