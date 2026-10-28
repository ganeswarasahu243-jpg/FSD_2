-- ==============================================================================
-- Sentinel Core Security Hardening Migration
-- Migration: 20261029000000_security_hardening.sql
-- Description: Idempotently drops insecure anonymous read policies, revokes
--              direct table access from anon, and hardens storage bucket.
-- ==============================================================================

-- 1. Drop insecure anonymous read policies if present
DROP POLICY IF EXISTS "allow_read_users" ON public.users;
DROP POLICY IF EXISTS "allow_read_users_profile" ON public.users;
DROP POLICY IF EXISTS "allow_read_policies" ON public.policies;
DROP POLICY IF EXISTS "allow_read_rules" ON public.rules;
DROP POLICY IF EXISTS "allow_read_logs" ON public.logs;
DROP POLICY IF EXISTS "allow_read_violations" ON public.violations;

-- 2. Explicitly revoke public access on all core tables from the anon role
REVOKE ALL ON TABLE public.users FROM anon;
REVOKE ALL ON TABLE public.policies FROM anon;
REVOKE ALL ON TABLE public.rules FROM anon;
REVOKE ALL ON TABLE public.logs FROM anon;
REVOKE ALL ON TABLE public.violations FROM anon;

-- 3. Ensure service_role retain explicit administrative access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'service_role_all_users') THEN
    CREATE POLICY "service_role_all_users" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'policies' AND policyname = 'service_role_all_policies') THEN
    CREATE POLICY "service_role_all_policies" ON public.policies FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rules' AND policyname = 'service_role_all_rules') THEN
    CREATE POLICY "service_role_all_rules" ON public.rules FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'logs' AND policyname = 'service_role_all_logs') THEN
    CREATE POLICY "service_role_all_logs" ON public.logs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'violations' AND policyname = 'service_role_all_violations') THEN
    CREATE POLICY "service_role_all_violations" ON public.violations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Harden policies storage bucket
UPDATE storage.buckets SET public = false WHERE id = 'policies';
DROP POLICY IF EXISTS "allow_authenticated_read_policies_storage" ON storage.objects;
