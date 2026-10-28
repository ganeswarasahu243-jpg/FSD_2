-- ==============================================================================
-- SVP SENTINEL CORE / POLICY PILOT: COMPLETE DATABASE SETUP FOR SUPABASE
-- Project: vkczojjnhmtnsgdwvxdj
-- Paste this entire file into: https://supabase.com/dashboard/project/vkczojjnhmtnsgdwvxdj/sql/new
-- and click RUN.
-- ==============================================================================

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

-- 8. Least-Privilege Access Configuration
-- In Sentinel Core architecture, all client operations are mediated by Edge Functions using service_role.
-- Direct PostgREST table access from anonymous users is explicitly revoked.
REVOKE ALL ON TABLE public.users FROM anon;
REVOKE ALL ON TABLE public.policies FROM anon;
REVOKE ALL ON TABLE public.rules FROM anon;
REVOKE ALL ON TABLE public.logs FROM anon;
REVOKE ALL ON TABLE public.violations FROM anon;

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



-- ==============================================================================

-- ==============================================================================
-- SVP Sentinel Core Seed Migration
-- Migration: 20261027000001_seed_sentinel_data.sql
-- Description: Idempotent data seed for users, policies, rules, logs, violations.
-- ==============================================================================

-- 1. Seed Users
INSERT INTO public.users (id, sqlite_id, username, password, role, email, first_name, last_name, is_active, date_joined, created_at) VALUES (1, 1, 'jayasurya', 'pbkdf2_sha256$1000000$9AcOXEsW9QyvgY78rkYL6t$AvXx3tUvU3sBSEaYo6O7E2XkEWoYs5+wZM2J8Zchjhg=', 'employee', '', '', '', TRUE, '2026-04-03T12:57:20.723Z', '2026-10-26T00:34:19.686Z') ON CONFLICT (username) DO UPDATE SET sqlite_id = EXCLUDED.sqlite_id, role = EXCLUDED.role, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;
INSERT INTO public.users (id, sqlite_id, username, password, role, email, first_name, last_name, is_active, date_joined, created_at) VALUES (2, 2, 'demo.employee', '$2a$10$YJPKOfhL/kcFVOMM3a89LewQ8rug25VAsH/t2B6UYcC4d6ADtHXz2', 'employee', '', '', '', TRUE, '2026-04-03T13:21:43.610Z', '2026-10-26T00:34:19.830Z') ON CONFLICT (username) DO UPDATE SET sqlite_id = EXCLUDED.sqlite_id, role = EXCLUDED.role, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;
INSERT INTO public.users (id, sqlite_id, username, password, role, email, first_name, last_name, is_active, date_joined, created_at) VALUES (3, 3, 'jaya surya', 'pbkdf2_sha256$1000000$865mz7ezlA7N2s8zqda0Rl$moy4X3FRL7ov66LP8Rd794SfY65+fxRHK04GBMnyBow=', 'employee', '', '', '', TRUE, '2026-04-03T13:30:13.202Z', '2026-10-26T00:34:19.837Z') ON CONFLICT (username) DO UPDATE SET sqlite_id = EXCLUDED.sqlite_id, role = EXCLUDED.role, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;
-- Historical test accounts are explicitly set to is_active = FALSE to prevent unauthorized production access
INSERT INTO public.users (id, sqlite_id, username, password, role, email, first_name, last_name, is_active, date_joined, created_at) VALUES (4, 4, 'testuser_1792974909657', '$2a$10$YJOJcdMSHM0tBTpyD8UqI.s7alEZBf0/Eiry63X6zz6T0b1unk3mq', 'compliance_officer', 'testuser_1792974909657@example.com', 'Test', 'Officer', FALSE, '2026-10-26T00:35:09.838Z', '2026-10-26T00:35:09.843Z') ON CONFLICT (username) DO UPDATE SET sqlite_id = EXCLUDED.sqlite_id, role = EXCLUDED.role, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, is_active = FALSE;
INSERT INTO public.users (id, sqlite_id, username, password, role, email, first_name, last_name, is_active, date_joined, created_at) VALUES (5, 5, 'testuser_1792975676526', '$2a$10$py.qduXyYVsz.x5Fnj.UFOaQYIaVOl3e72QSxzf2osmqKYtSjePK.', 'compliance_officer', 'testuser_1792975676526@example.com', 'Test', 'Officer', FALSE, '2026-10-26T00:47:56.690Z', '2026-10-26T00:47:56.694Z') ON CONFLICT (username) DO UPDATE SET sqlite_id = EXCLUDED.sqlite_id, role = EXCLUDED.role, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, is_active = FALSE;
INSERT INTO public.users (id, sqlite_id, username, password, role, email, first_name, last_name, is_active, date_joined, created_at) VALUES (6, 6, 'testuser_1792978916827', '$2a$10$AHl.kkhCxnYbz5oAD9FMTO3pu4mpiltStcfJL3yJAstoqc7USjmlS', 'compliance_officer', 'testuser_1792978916827@example.com', 'Test', 'Officer', FALSE, '2026-10-26T01:41:57.040Z', '2026-10-26T01:41:57.047Z') ON CONFLICT (username) DO UPDATE SET sqlite_id = EXCLUDED.sqlite_id, role = EXCLUDED.role, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, is_active = FALSE;
INSERT INTO public.users (id, sqlite_id, username, password, role, email, first_name, last_name, is_active, date_joined, created_at) VALUES (7, 7, 'testuser_1792981218637', '$2a$10$8MZPlsPbufaX3ZWsMHRHW.AcT9XuA8KUuwcv28km6SUwQ5hM5KPwG', 'compliance_officer', 'testuser_1792981218637@example.com', 'Test', 'Officer', FALSE, '2026-10-26T02:20:18.760Z', '2026-10-26T02:20:18.763Z') ON CONFLICT (username) DO UPDATE SET sqlite_id = EXCLUDED.sqlite_id, role = EXCLUDED.role, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, is_active = FALSE;
INSERT INTO public.users (id, sqlite_id, username, password, role, email, first_name, last_name, is_active, date_joined, created_at) VALUES (8, 8, 'testuser_1793074536784', '$2a$10$yDM0z/a6lS4SSAEgwjXl0efeDuv1BngiyxjswvLGbodj/c5BKX9EW', 'compliance_officer', 'testuser_1793074536784@example.com', 'Test', 'Officer', FALSE, '2026-10-27T04:15:37.707Z', '2026-10-27T04:15:37.712Z') ON CONFLICT (username) DO UPDATE SET sqlite_id = EXCLUDED.sqlite_id, role = EXCLUDED.role, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, is_active = FALSE;
INSERT INTO public.users (id, sqlite_id, username, password, role, email, first_name, last_name, is_active, date_joined, created_at) VALUES (9, 9, 'testuser_1793077987487', '$2a$10$TLxFvBjfALdaQ/bTCsfrOO9paIythdTDEFfNkCFjYD0g2SHXHHCqG', 'compliance_officer', 'testuser_1793077987487@example.com', 'Test', 'Officer', FALSE, '2026-10-27T05:13:08.450Z', '2026-10-27T05:13:08.492Z') ON CONFLICT (username) DO UPDATE SET sqlite_id = EXCLUDED.sqlite_id, role = EXCLUDED.role, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, is_active = FALSE;
INSERT INTO public.users (id, sqlite_id, username, password, role, email, first_name, last_name, is_active, date_joined, created_at) VALUES (10, 10, 'testuser_1793079271149', '$2a$10$oulUPH.9GY9c.4Hso./UJuszh7u1Q1WzC2xvhd7h/duvsKV2ug8om', 'compliance_officer', 'testuser_1793079271149@example.com', 'Test', 'Officer', FALSE, '2026-10-27T05:34:31.251Z', '2026-10-27T05:34:31.254Z') ON CONFLICT (username) DO UPDATE SET sqlite_id = EXCLUDED.sqlite_id, role = EXCLUDED.role, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, is_active = FALSE;
INSERT INTO public.users (id, sqlite_id, username, password, role, email, first_name, last_name, is_active, date_joined, created_at) VALUES (11, 11, 'testuser_1793079307562', '$2a$10$VYa1oO58DfLd18WNKqhTfeS6PkN6bqJ2K3J4cwZaIVtJDGrE5zixy', 'compliance_officer', 'testuser_1793079307562@example.com', 'Test', 'Officer', FALSE, '2026-10-27T05:35:07.667Z', '2026-10-27T05:35:07.670Z') ON CONFLICT (username) DO UPDATE SET sqlite_id = EXCLUDED.sqlite_id, role = EXCLUDED.role, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, is_active = FALSE;
INSERT INTO public.users (id, sqlite_id, username, password, role, email, first_name, last_name, is_active, date_joined, created_at) VALUES (12, 12, 'demo.admin', '$2b$10$S8INWOeZGnkR8P8cGlaXS.rxYcckT3dTaDbbJinI1tW0wXUd3FKx2', 'admin', 'demo.admin@sentinel.internal', 'Demo', 'Administrator', TRUE, '2026-10-29T00:00:00.000Z', '2026-10-29T00:00:00.000Z') ON CONFLICT (username) DO UPDATE SET sqlite_id = EXCLUDED.sqlite_id, role = EXCLUDED.role, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, is_active = TRUE;
SELECT setval(pg_get_serial_sequence('public.users', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.users));

-- 2. Seed Policies
INSERT INTO public.policies (id, sqlite_id, title, document, source_name, content_text, uploaded_by, uploaded_by_username, created_at) VALUES (1, 1, 'google', 'policies/google_privacy_policy_en.pdf', 'google_privacy_policy_en.pdf', 'Privacy Policy
Last modified: December 18, 2017 ( view archived versions ) (The hyperlinked examples are available at the end of this
document.)
There are many different ways you can use our services – to search for and share information, to communicate with other
people or to create new content. When you share information with us, for example by creating a Google Account , we can make
those services even better – to show you more relevant search results  and ads, to help you connect with people  or to make
sharing with others quicker and easier . As you use our services, we want you to be clear how we’re using information and
the ways in which you can protect your privacy.
Our Privacy Policy explains:
 What information we collect and why we collect it.
 How we use that information.
 The choices we offer, including how to access and update information.
We’ve tried to keep it as simple as possible, but if you’re not familiar with terms like cookies, IP addresses, pixel tags and
browsers, then read about these key terms  first. Your privacy matters to Google so whether you are new to Google or a long-
time user, please do take the time to get to know our practices – and if you have any questions contact us .
Information we collect
We collect information to provide better services to all of our users – from figuring out basic stuff like which language you speak,
to more complex things like which ads you’ll find most useful , the people who matter most to you online , or which
YouTube videos you might like.
We collect information in the following ways:
 Information you give us.  For example, many of our services require you to sign up for a Google Account. When you
 do, we’ll ask for personal information , like your name, email address, telephone number or credit card  to store with your
 account. If you want to take full advantage of the sharing features we offer, we might also ask you to create a publicly
 visible Google Profile , which may include your name and photo.
 Information we get from your use of our services.  We collect information  about the services that you use and how
 you use them, like when you watch a video on YouTube, visit a website that uses our advertising services, or view and
 interact with our ads  and content. This information includes:
 Device information
 We collect device-specific information  (such as your hardware model, operating system version, unique device
 identifiers , and mobile network information including phone number). Google may associate your device
 identifiers  or phone number  with your Google Account.
 Log information
 When you use our services or view content provided by Google, we automatically collect and store certain
 information in server logs . This includes:
 details of how you used our service, such as your search queries.
 telephony log information like your phone number, calling-party number, forwarding numbers, time and
 date of calls, duration of calls, SMS routing information and types of calls.
 Internet protocol address .
 device event information such as crashes, system activity, hardware settings, browser type, browserlanguage, the date and time of your request and referral URL.
 cookies that may uniquely identify your browser or your Google Account.
 Location information
 When you use Google services, we may collect and process information about your actual location . We use
 various technologies to determine location, including IP address, GPS, and other sensors  that may, for
 example, provide Google with information on nearby devices, Wi-Fi access points and cell towers .
 Unique application numbers
 Certain services include a unique application number. This number and information about your installation (for
 example, the operating system type and application version number) may be sent to Google when you install or
 uninstall that service or when that service periodically contacts our servers, such as for automatic updates.
 Local storage
 We may collect and store information (including personal information) locally on your device using mechanisms
 such as browser web storage  (including HTML 5) and application data caches .
 Cookies and similar technologies
 We and our partners  use various technologies to collect and store information when you visit a Google service,
 and this may include using cookies or similar technologies  to identify your browser or device. We also use these
 technologies to collect and store information when you interact with services we offer to our partners, such as
 advertising services  or Google features that may appear on other sites. Our Google Analytics product helps
 businesses and site owners analyze the traffic to their websites and apps. When used in conjunction with our
 advertising services, such as those using the DoubleClick cookie, Google Analytics information is linked, by the
 Google Analytics customer or by Google, using Google technology, with information about visits to
 multiple sites .
Information we collect when you are signed in to Google, in addition to information we obtain about you from partners, may be
associated with your Google Account. When information is associated with your Google Account, we treat it as personal
information. For more information about how you can access, manage or delete information that is associated with your Google
Account, visit the Transparency and choice  section of this policy.
How we use information we collect
We use the information we collect from all of our services to provide , maintain , protect  and improve them, to develop new
ones , and to protect Google and our users . We also use this information to offer you tailored content – like giving you more
relevant search results and ads.
We may use the name you provide for your Google Profile across all of the services we offer that require a Google Account. In
addition, we may replace past names associated with your Google Account so that you are represented consistently across all
our services. If other users already have your email, or other information that identifies you, we may show them your publicly
visible Google Profile information, such as your name and photo.
If you have a Google Account, we may display your Profile name, Profile photo, and actions you take on Google or on third-
party applications connected to your Google Account (such as +1’s, reviews you write and comments you post) in our services,
including displaying in ads and other commercial contexts. We will respect the choices you make to limit sharing or visibility
settings  in your Google Account.
When you contact Google, we keep a record of your communication to help solve any issues you might be facing. We may use
your email address to inform you about our services, such as letting you know about upcoming changes or improvements.
We use information collected from cookies and other technologies, like pixel tags , to improve your user experience  and the
overall quality of our services. One of the products we use to do this on our own services is Google Analytics. For example, by
saving your language preferences, we’ll be able to have our services appear in the language you prefer. When showing you
tailored ads, we will not associate an identifier from cookies or similar technologies with sensitive categories , such as those
based on race, religion, sexual orientation or health.
Our automated systems analyze your content (including emails) to provide you personally relevant product features, such ascustomized search results, tailored advertising, and spam and malware detection.
We may combine personal information from one service with information, including personal information, from other
Google services  – for example to make it easier to share things with people you know . Depending on your account
settings , your activity on other sites and apps  may be associated with your personal information in order to improve Google’s
services and the ads delivered by Google.
We will ask for your consent before using information for a purpose other than those that are set out in this Privacy Policy.
Google processes personal information on our servers in many countries around the world. We may process your personal
information on a server located outside the country where you live.
Transparency and choice
People have different privacy concerns. Our goal is to be clear about what information we collect, so that you can make
meaningful choices about how it is used. For example, you can:
 Review and update your Google activity controls  to decide what types of data, such as videos you’ve watched on
 YouTube or past searches, you would like saved with your account when you use Google services. You can also visit
 these controls  to manage whether certain activity is stored in a cookie or similar technology on your device when you
 use our services while signed-out of your account.
 Review and control  certain types of information tied to your Google Account by using Google Dashboard.
 View and edit  your preferences about the Google ads shown to you on Google and across the web, such as which
 categories might interest you, using Ads Settings. You can also visit that page to opt out of certain Google advertising
 services.
 Adjust  how the Profile associated with your Google Account appears to others.
 Control  who you share information with through your Google Account.
 Take information  associated with your Google Account out of many of our services.
 Choose  whether your Profile name and Profile photo appear in shared endorsements that appear in ads.
You may also set your browser to block all cookies, including cookies associated with our services, or to indicate when a cookie
is being set by us. However, it’s important to remember that many of our services may not function properly  if your cookies
are disabled. For example, we may not remember your language preferences.
Information you share
Many of our services let you share information with others. Remember that when you share information publicly, it may be
indexable by search engines, including Google. Our services provide you with different options on sharing  and removing your
content .
Accessing and updating your personal information
Whenever you use our services, we aim to provide you with access to your personal information . If that information is wrong,
we strive to give you ways to update it quickly or to delete it – unless we have to keep that information for legitimate business or
legal purposes.
We aim to maintain our services in a manner that protects information from accidental or malicious destruction. Because of this,
after you delete information from our services, we may not immediately delete residual copies from our active servers and may
not remove information from our backup systems.
Information we share
We do not share personal information with companies, organizations and individuals outside of Google unless one of the
following circumstances applies:
 With your consent
 We will share personal information with companies, organizations or individuals outside of Google when we have your
 consent to do so. We require opt-in consent for the sharing of any sensitive personal information .
 With domain administratorsIf your Google Account is managed for you by a domain administrator  (for example, for G Suite users) then your domain
 administrator and resellers who provide user support to your organization will have access to your Google Account
 information (including your email and other data). Your domain administrator may be able to:
 view statistics regarding your account, like statistics regarding applications you install.
 change your account password.
 suspend or terminate your account access.
 access or retain information stored as part of your account.
 receive your account information in order to satisfy applicable law, regulation, legal process or enforceable
 governmental request .
 restrict your ability to delete or edit information or privacy settings.
 Please refer to your domain administrator’s privacy policy for more information.
 For external processing
 We provide personal information to our affiliates  or other trusted businesses or persons to process it for us, based on our
 instructions and in compliance with our Privacy Policy and any other appropriate confidentiality and security measures.
 For legal reasons
 We will share personal information with companies, organizations or individuals outside of Google if we have a good-
 faith belief that access, use, preservation or disclosure of the information is reasonably necessary to:
 meet any applicable law, regulation, legal process or enforceable governmental request .
 enforce applicable Terms of Service, including investigation of potential violations.
 detect, prevent, or otherwise address fraud, security or technical issues.
 protect against harm to the rights, property or safety of Google, our users or the public as required or permitted
 by law.
We may share  non-personally identifiable information  publicly and with our partners – like publishers, advertisers or connected
sites. For example, we may share information publicly to show trends  about the general use of our services.
If Google is involved in a merger, acquisition or asset sale, we will continue to ensure the confidentiality of any personal
information and give affected users notice before personal information is transferred or becomes subject to a different privacy
policy.
Information security
We work hard to protect Google and our users from unauthorized access to or unauthorized alteration, disclosure or destruction
of information we hold. In particular:
 We encrypt many of our services using SSL .
 We offer you two step verification  when you access your Google Account, and a Safe Browsing feature  in Google
 Chrome.
 We review our information collection, storage and processing practices, including physical security measures, to guard
 against unauthorized access to systems.
 We restrict access to personal information to Google employees, contractors and agents who need to know that
 information in order to process it for us, and who are subject to strict contractual confidentiality obligations and may be
 disciplined or terminated if they fail to meet these obligations.
When this Privacy Policy applies
Our Privacy Policy applies to all of the services offered by Google LLC and its affiliates, including YouTube, services Google
provides on Android devices, and services offered on other sites (such as our advertising services), but excludes services that
have separate privacy policies that do not incorporate this Privacy Policy.
Our Privacy Policy does not apply to services offered by other companies or individuals, including products or sites that may be
displayed to you in search results, sites that may include Google services, or other sites linked from our services. Our Privacy
Policy does not cover the information practices of other companies and organizations who advertise our services, and who may
use cookies, pixel tags and other technologies to serve and offer relevant ads.Compliance and cooperation with regulatory authorities
We regularly review our compliance with our Privacy Policy. We also adhere to several self regulatory frameworks , including the
EU-US and Swiss-US Privacy Shield Frameworks. When we receive formal written complaints, we will contact the person who
made the complaint to follow up. We work with the appropriate regulatory authorities, including local data protection authorities,
to resolve any complaints regarding the transfer of personal data that we cannot resolve with our users directly.
Changes
Our Privacy Policy may change from time to time. We will not reduce your rights under this Privacy Policy without your explicit
consent. We will post any privacy policy changes on this page and, if the changes are significant, we will provide a more
prominent notice (including, for certain services, email notification of privacy policy changes). We will also keep prior versions of
this Privacy Policy in an archive for your review.
Specific product practices
The following notices explain specific privacy practices with respect to certain Google products and services that you may use:
 Chrome and Chrome OS
 Play Books
 Payments
 Fiber
 Project Fi
 G Suite for Education
 YouTube Kids
 Google Accounts Managed with Family Link
For more information about some of our most popular services, you can visit the Google Product Privacy Guide .
Other useful privacy and security related materials
Further useful privacy and security related materials can be found through Google’s policies and principles pages , including:
 Information about our technologies and principles , which includes, among other things, more information on
 how Google uses cookies .
 technologies we use for advertising .
 how we recognize patterns like faces .
 A page  that explains what data is shared with Google when you visit websites that use our advertising, analytics and
 social products.
 The Privacy Checkup  tool, which makes it easy to review your key privacy settings.
 Google’s safety center , which provides information on how to stay safe and secure online.
"access to your personal information"
For example, with Google Dashboard you can quickly and easily see some of the data associated with your Google Account.
Learn more.
"ads you’ll find most useful"
For example, if you frequently visit websites and blogs about gardening, you may see ads related to gardening as you browse
the web.
Learn more.
"advertising services"
For example, if you frequently visit websites and blogs about gardening that show our ads, you may start to see ads related to
this interest as you browse the web.
Learn more."and other sensors"
Your device may have sensors that provide information to assist in a better understanding of your location. For example, an
accelerometer can be used to determine things like speed, or a gyroscope to figure out direction of travel.
Learn more.
"collect information"
This includes information like your usage data and preferences, Gmail messages, G+ profile, photos, videos, browsing history,
map searches, docs, or other Google-hosted content.
Learn more.
"combine personal information from one service with information, including personal information, from other Google
services"
For example, when you’re signed in to your Google Account and search on Google, you can see search results from the public
web, along with pages, photos, and Google+ posts from your friends and people who know you or follow you on Google+ may
see your posts and profile in their results.
Learn more.
"connect with people"
For example, you could get suggestions of people you might know or want to connect with on Google+, based on the
connections you have with people on other Google products, like Gmail; and people who have a connection with you may see
your profile as a suggestion.
Learn more.
"credit card"
Whilst we currently don’t ask for a credit card during sign up, verifying your age through a small credit card transaction is one
way to confirm that you meet our age requirements in case your account was disabled after you have entered a birthday
indicating you are not old enough to have a Google Account.
Learn more.
"develop new ones"
For example, Google’s spell checking software was developed by analyzing previous searches where users had corrected their
own spelling.
Learn more.
"device identifiers"
Device identifiers let Google know which unique device you are using to access our services, which can be used to customise
our service to your device or analyse any device issues related to our services.
Learn more.
"device-specific information"
For example, when you visit Google Play from your desktop, Google can use this information to help you decide on which
devices you''d like your purchases to be available for use.
Learn more.
"improve your user experience"
For example, cookies allow us to analyse how users interact with our services.
Learn more.
"legal process or enforceable governmental request"
Like other technology and communications companies, Google regularly receives requests from governments and courtsaround the world to hand over user data. Our legal team reviews each and every request, regardless of type, and we frequently
push back when the requests appear to be overly broad or don’t follow the correct process.
Learn more.
"limit sharing or visibility settings"
For example, you can choose your settings so your name and photo do not appear in an ad.
Learn more.
"linked with information about visits to multiple sites"
Google Analytics is based on first-party cookies. Data generated through Google Analytics can be linked, by the Google
Analytics customer or by Google, using Google technology, to third-party cookies, related to visits to other websites, for instance
when an advertiser wants to use its Google Analytics data to create more relevant ads, or to further analyze its traffic.
Learn more.
"maintain"
For example, we continuously monitor our systems to check that they are working as intended and in order to detect and fix
errors.
Learn more.
"may collect and process information about your actual location"
For example, Google Maps can center the maps view on your current location.
Learn more.
"may not function properly"
For example, we use a cookie called ‘lbcs’ which makes it possible for you to open many Google Docs in one browser.
Learn more.
"and our partners"
We allow trusted businesses to use cookies or similar technologies for advertising and research purposes on our services.
Learn more.
"phone number"
For example, if you add a phone number as a recovery option, if you forget your password Google can send you a text message
with a code to enable you to reset it.
Learn more.
"protect Google and our users"
For example, if you''re concerned about unauthorized access to your email, "Last account activity" in Gmail shows you
information about recent activity in your email, such as the IP addresses that accessed your mail, the associated location, as
well as the time and date.
Learn more.
"protect"
For example, one reason we collect and analyze IP addresses and cookies is to protect our services against automated abuse.
Learn more.
"provide"
For example, the IP address assigned to your device is used to send the data you requested back to your device.
Learn more."sharing"
For example, with Google+, you have many different sharing options.
Learn more.
"sharing with others quicker and easier"
For example, if someone is already a contact, Google will autocomplete their name if you want to add them to a message in
Gmail.
Learn more.
"the people who matter most to you online"
For example, when you type an address in the To, Cc, or Bcc field of a message you''re composing, Gmail will suggest
addresses from your Contacts list.
Learn more.
"to make it easier to share things with people you know"
For example, if you have communicated with someone via Gmail and want to add them to a Google Doc or an event in Google
Calendar, Google makes it easy to do so by autocompleting their email address when you start to type in their name.
Learn more.
"view and interact with our ads"
For example, we regularly report to advertisers on whether we served their ad to a page and whether that ad was likely to be
seen by users (as opposed to, for example, being on part of the page to which users did not scroll).
Learn more.
"We may share aggregated, non-personally identifiable information publicly"
When lots of people start searching for something, it can provide very useful information about particular trends at that time.
Learn more.
"Wi-Fi access points and cell towers"
For example, Google can approximate your device’s location based on the known location of nearby cell towers.
Learn more.
"more relevant search results"
For example, we can make search more relevant and interesting for you by including photos, posts, and more from you and
your friends.
Learn more.
"removing your content"
For example, you can delete your Web & App Activity , your blog , a Google Site you own , your YouTube Channel , your Google+
profile  or your entire Google account .
Learn more.
"to show trends"
You can see some of these at Google Trends  and YouTube Trending Videos .
Learn more.
"your activity on other sites and apps"
This activity might come from your use of Google products like Chrome Sync or from your visits to sites and apps that partner
with Google. Many websites and apps partner with Google to improve their content and services. For example, a website mightuse our advertising services (like AdSense) or analytics tools (like Google Analytics). These products share information about
your activity with Google and, depending on your account settings  and the products in use (for instance, when a partner uses
Google Analytics in conjunction with our advertising services), this data may be associated with your personal information.
Learn more.', 1, 'jayasurya', '2026-04-03T13:01:04.422Z') ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, document = EXCLUDED.document, source_name = EXCLUDED.source_name, content_text = EXCLUDED.content_text, uploaded_by = EXCLUDED.uploaded_by;
INSERT INTO public.policies (id, sqlite_id, title, document, source_name, content_text, uploaded_by, uploaded_by_username, created_at) VALUES (2, 2, 'Financial Record Storage Policy', NULL, 'Direct text input', 'Customer financial records must be stored in encrypted repositories. Backups must occur daily.', 4, 'testuser_1792974909657', '2026-10-26T00:35:10.026Z') ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, document = EXCLUDED.document, source_name = EXCLUDED.source_name, content_text = EXCLUDED.content_text, uploaded_by = EXCLUDED.uploaded_by;
INSERT INTO public.policies (id, sqlite_id, title, document, source_name, content_text, uploaded_by, uploaded_by_username, created_at) VALUES (3, 3, 'Financial Record Storage Policy', NULL, 'Direct text input', 'Customer financial records must be stored in encrypted repositories. Backups must occur daily.', 5, 'testuser_1792975676526', '2026-10-26T00:47:56.861Z') ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, document = EXCLUDED.document, source_name = EXCLUDED.source_name, content_text = EXCLUDED.content_text, uploaded_by = EXCLUDED.uploaded_by;
INSERT INTO public.policies (id, sqlite_id, title, document, source_name, content_text, uploaded_by, uploaded_by_username, created_at) VALUES (4, 4, 'Financial Record Storage Policy', NULL, 'Direct text input', 'Customer financial records must be stored in encrypted repositories. Backups must occur daily.', 6, 'testuser_1792978916827', '2026-10-26T01:41:57.303Z') ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, document = EXCLUDED.document, source_name = EXCLUDED.source_name, content_text = EXCLUDED.content_text, uploaded_by = EXCLUDED.uploaded_by;
INSERT INTO public.policies (id, sqlite_id, title, document, source_name, content_text, uploaded_by, uploaded_by_username, created_at) VALUES (5, 5, 'Financial Record Storage Policy', NULL, 'Direct text input', 'Customer financial records must be stored in encrypted repositories. Backups must occur daily.', 7, 'testuser_1792981218637', '2026-10-26T02:20:18.879Z') ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, document = EXCLUDED.document, source_name = EXCLUDED.source_name, content_text = EXCLUDED.content_text, uploaded_by = EXCLUDED.uploaded_by;
INSERT INTO public.policies (id, sqlite_id, title, document, source_name, content_text, uploaded_by, uploaded_by_username, created_at) VALUES (6, 6, 'Financial Record Storage Policy', NULL, 'Direct text input', 'Customer financial records must be stored in encrypted repositories. Backups must occur daily.', 8, 'testuser_1793074536784', '2026-10-27T04:15:37.888Z') ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, document = EXCLUDED.document, source_name = EXCLUDED.source_name, content_text = EXCLUDED.content_text, uploaded_by = EXCLUDED.uploaded_by;
INSERT INTO public.policies (id, sqlite_id, title, document, source_name, content_text, uploaded_by, uploaded_by_username, created_at) VALUES (7, 7, 'Financial Record Storage Policy', NULL, 'Direct text input', 'Customer financial records must be stored in encrypted repositories. Backups must occur daily.', 9, 'testuser_1793077987487', '2026-10-27T05:13:08.836Z') ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, document = EXCLUDED.document, source_name = EXCLUDED.source_name, content_text = EXCLUDED.content_text, uploaded_by = EXCLUDED.uploaded_by;
INSERT INTO public.policies (id, sqlite_id, title, document, source_name, content_text, uploaded_by, uploaded_by_username, created_at) VALUES (8, 8, 'Financial Record Storage Policy', NULL, 'Direct text input', 'Customer financial records must be stored in encrypted repositories. Backups must occur daily.', 10, 'testuser_1793079271149', '2026-10-27T05:34:31.367Z') ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, document = EXCLUDED.document, source_name = EXCLUDED.source_name, content_text = EXCLUDED.content_text, uploaded_by = EXCLUDED.uploaded_by;
INSERT INTO public.policies (id, sqlite_id, title, document, source_name, content_text, uploaded_by, uploaded_by_username, created_at) VALUES (9, 9, 'Financial Record Storage Policy', NULL, 'Direct text input', 'Customer financial records must be stored in encrypted repositories. Backups must occur daily.', 11, 'testuser_1793079307562', '2026-10-27T05:35:07.786Z') ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, document = EXCLUDED.document, source_name = EXCLUDED.source_name, content_text = EXCLUDED.content_text, uploaded_by = EXCLUDED.uploaded_by;
SELECT setval(pg_get_serial_sequence('public.policies', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.policies));

-- 3. Seed Rules
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (1, 1, 1, 'Privacy Policy
Last modified: December 18, 2017 ( view archived versions ) (The hyperlinked examples are available at the end of this
document.)
There are many different ways you c', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-26T00:34:19.864Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (2, 2, 1, 'When you share information with us, for example by creating a Google Account , we can make
those services even better – to show you more relevant search results  and ads, to help y', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-26T00:34:19.868Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (3, 3, 1, 'As you use our services, we want you to be clear how we’re using information and
the ways in which you can protect your privacy.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-26T00:34:19.873Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (4, 4, 2, 'Customer financial records must be stored in encrypted repositories.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-26T00:35:10.030Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (5, 5, 2, 'Backups must occur daily.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-26T00:35:10.033Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (6, 6, 3, 'Customer financial records must be stored in encrypted repositories.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-26T00:47:56.864Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (7, 7, 3, 'Backups must occur daily.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-26T00:47:56.866Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (8, 8, 4, 'Customer financial records must be stored in encrypted repositories.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-26T01:41:57.312Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (9, 9, 4, 'Backups must occur daily.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-26T01:41:57.317Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (10, 10, 5, 'Customer financial records must be stored in encrypted repositories.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-26T02:20:18.882Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (11, 11, 5, 'Backups must occur daily.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-26T02:20:18.884Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (12, 12, 6, 'Customer financial records must be stored in encrypted repositories.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-27T04:15:37.913Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (13, 13, 6, 'Backups must occur daily.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-27T04:15:37.927Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (14, 14, 7, 'Customer financial records must be stored in encrypted repositories.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-27T05:13:08.846Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (15, 15, 7, 'Backups must occur daily.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-27T05:13:08.855Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (16, 16, 8, 'Customer financial records must be stored in encrypted repositories.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-27T05:34:31.369Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (17, 17, 8, 'Backups must occur daily.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-27T05:34:31.370Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (18, 18, 9, 'Customer financial records must be stored in encrypted repositories.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-27T05:35:07.788Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) VALUES (19, 19, 9, 'Backups must occur daily.', 'When this policy requirement applies', 'Review the clause, assign an owner, and update the mapped business process.', '2026-10-27T05:35:07.790Z') ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;
SELECT setval(pg_get_serial_sequence('public.rules', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.rules));

-- 4. Seed Logs
INSERT INTO public.logs (id, sqlite_id, user_id, username, action, created_at) VALUES (2, 2, 2, 'demo.employee', 'spam in google', '2026-10-26T00:34:19.880Z') ON CONFLICT (id) DO UPDATE SET action = EXCLUDED.action, username = EXCLUDED.username;
INSERT INTO public.logs (id, sqlite_id, user_id, username, action, created_at) VALUES (3, 3, 2, 'demo.employee', 'Shared confidential payroll and customer data to external USB drive', '2026-10-26T00:35:10.041Z') ON CONFLICT (id) DO UPDATE SET action = EXCLUDED.action, username = EXCLUDED.username;
INSERT INTO public.logs (id, sqlite_id, user_id, username, action, created_at) VALUES (4, 4, 2, 'demo.employee', 'Shared confidential payroll and customer data to external USB drive', '2026-10-26T00:47:56.872Z') ON CONFLICT (id) DO UPDATE SET action = EXCLUDED.action, username = EXCLUDED.username;
INSERT INTO public.logs (id, sqlite_id, user_id, username, action, created_at) VALUES (5, 5, 2, 'demo.employee', 'Shared confidential payroll and customer data to external USB drive', '2026-10-26T01:41:57.333Z') ON CONFLICT (id) DO UPDATE SET action = EXCLUDED.action, username = EXCLUDED.username;
INSERT INTO public.logs (id, sqlite_id, user_id, username, action, created_at) VALUES (6, 6, 2, 'demo.employee', 'Shared confidential payroll and customer data to external USB drive', '2026-10-26T02:20:18.890Z') ON CONFLICT (id) DO UPDATE SET action = EXCLUDED.action, username = EXCLUDED.username;
INSERT INTO public.logs (id, sqlite_id, user_id, username, action, created_at) VALUES (7, 7, 2, 'demo.employee', 'Shared confidential payroll and customer data to external USB drive', '2026-10-27T04:15:37.933Z') ON CONFLICT (id) DO UPDATE SET action = EXCLUDED.action, username = EXCLUDED.username;
INSERT INTO public.logs (id, sqlite_id, user_id, username, action, created_at) VALUES (8, 8, 2, 'demo.employee', 'Shared confidential payroll and customer data to external USB drive', '2026-10-27T05:13:08.875Z') ON CONFLICT (id) DO UPDATE SET action = EXCLUDED.action, username = EXCLUDED.username;
INSERT INTO public.logs (id, sqlite_id, user_id, username, action, created_at) VALUES (9, 9, 2, 'demo.employee', 'Shared confidential payroll and customer data to external USB drive', '2026-10-27T05:34:31.375Z') ON CONFLICT (id) DO UPDATE SET action = EXCLUDED.action, username = EXCLUDED.username;
INSERT INTO public.logs (id, sqlite_id, user_id, username, action, created_at) VALUES (10, 10, 2, 'demo.employee', 'Shared confidential payroll and customer data to external USB drive', '2026-10-27T05:35:07.795Z') ON CONFLICT (id) DO UPDATE SET action = EXCLUDED.action, username = EXCLUDED.username;
SELECT setval(pg_get_serial_sequence('public.logs', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.logs));

-- 5. Seed Violations
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (1, 1, 3, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-26T00:35:10.049Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (2, 2, 4, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-26T00:47:56.879Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (3, 3, 4, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-26T00:47:56.882Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (4, 4, 5, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-26T01:41:57.353Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (5, 5, 5, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-26T01:41:57.358Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (6, 6, 5, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-26T01:41:57.362Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (7, 7, 6, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-26T02:20:18.897Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (8, 8, 6, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-26T02:20:18.899Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (9, 9, 6, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-26T02:20:18.901Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (10, 10, 6, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-26T02:20:18.903Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (11, 11, 7, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T04:15:37.969Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (12, 12, 7, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T04:15:37.971Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (13, 13, 7, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T04:15:37.973Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (14, 14, 7, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T04:15:37.975Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (15, 15, 7, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T04:15:37.977Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (16, 16, 8, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:13:08.903Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (17, 17, 8, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:13:08.910Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (18, 18, 8, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:13:08.917Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (19, 19, 8, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:13:08.920Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (20, 20, 8, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:13:08.926Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (21, 21, 8, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:13:08.931Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (22, 22, 9, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:34:31.382Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (23, 23, 9, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:34:31.383Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (24, 24, 9, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:34:31.403Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (25, 25, 9, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:34:31.405Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (26, 26, 9, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:34:31.406Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (27, 27, 9, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:34:31.407Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (28, 28, 9, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:34:31.409Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (29, 29, 10, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:35:07.801Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (30, 30, 10, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:35:07.802Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (31, 31, 10, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:35:07.804Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (32, 32, 10, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:35:07.805Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (33, 33, 10, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:35:07.807Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (34, 34, 10, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:35:07.808Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (35, 35, 10, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:35:07.808Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) VALUES (36, 36, 10, 'Customer financial records must be stored in encrypted repositories.: When this policy requirement applies', '2026-10-27T05:35:07.809Z') ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;
SELECT setval(pg_get_serial_sequence('public.violations', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.violations));
