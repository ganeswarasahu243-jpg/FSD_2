const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('\n======================================================');
  console.log(' SUPABASE EDGE FUNCTIONS & POSTGRESQL VERIFICATION SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // --- 1. Schema & Migrations Tests ---
  await test('PostgreSQL Schema Migration exists with all tables & RLS', async () => {
    const schemaPath = path.resolve(__dirname, '..', '..', 'supabase', 'migrations', '20261027000000_create_sentinel_schema.sql');
    if (!fs.existsSync(schemaPath)) throw new Error('Schema migration missing');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    const requiredTables = ['public.users', 'public.policies', 'public.rules', 'public.logs', 'public.violations'];
    for (const tbl of requiredTables) {
      if (!sql.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`)) {
        throw new Error(`Missing table definition for ${tbl}`);
      }
    }

    if (!sql.includes('ENABLE ROW LEVEL SECURITY')) throw new Error('Missing RLS enabling');
    if (!sql.includes("'policies', 'policies'")) throw new Error('Missing storage bucket setup for policies');
  });

  await test('PostgreSQL Schema Migration has removed anonymous read policies and revoked anon access', async () => {
    const schemaPath = path.resolve(__dirname, '..', '..', 'supabase', 'migrations', '20261027000000_create_sentinel_schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    const insecurePolicies = [
      'allow_read_users',
      'allow_read_policies',
      'allow_read_rules',
      'allow_read_logs',
      'allow_read_violations',
    ];
    for (const pol of insecurePolicies) {
      if (sql.includes(`CREATE POLICY ${pol}`)) {
        throw new Error(`Insecure policy ${pol} is still defined in schema migration!`);
      }
    }

    const requiredRevokes = [
      'REVOKE ALL ON TABLE public.users FROM anon;',
      'REVOKE ALL ON TABLE public.policies FROM anon;',
      'REVOKE ALL ON TABLE public.rules FROM anon;',
      'REVOKE ALL ON TABLE public.logs FROM anon;',
      'REVOKE ALL ON TABLE public.violations FROM anon;',
    ];
    for (const rev of requiredRevokes) {
      if (!sql.includes(rev)) {
        throw new Error(`Missing anonymous revocation: ${rev}`);
      }
    }
  });

  await test('Deploy-All and Idempotent Hardening Migrations exist and enforce anon revocation', async () => {
    const deployAllPath = path.resolve(__dirname, '..', '..', 'supabase', 'migrations', 'deploy_all_to_supabase.sql');
    if (!fs.existsSync(deployAllPath)) throw new Error('deploy_all_to_supabase.sql is missing');
    const deploySql = fs.readFileSync(deployAllPath, 'utf8');
    if (deploySql.includes('CREATE POLICY allow_read_users')) {
      throw new Error('deploy_all_to_supabase.sql still includes allow_read_users');
    }
    if (!deploySql.includes('REVOKE ALL ON TABLE public.users FROM anon;')) {
      throw new Error('deploy_all_to_supabase.sql missing anon revocation');
    }

    const hardeningPath = path.resolve(__dirname, '..', '..', 'supabase', 'migrations', '20261029000000_security_hardening.sql');
    if (!fs.existsSync(hardeningPath)) throw new Error('20261029000000_security_hardening.sql is missing');
    const hardSql = fs.readFileSync(hardeningPath, 'utf8');
    if (!hardSql.includes('allow_read_users')) {
      throw new Error('Hardening migration missing DROP POLICY for users');
    }
    if (!hardSql.includes('REVOKE ALL ON TABLE public.users FROM anon;')) {
      throw new Error('Hardening migration missing REVOKE ALL FROM anon for users');
    }
  });

  await test('PostgreSQL Data Seed Migration exists with all authoritative records', async () => {
    const seedPath = path.resolve(__dirname, '..', '..', 'supabase', 'migrations', '20261027000001_seed_sentinel_data.sql');
    if (!fs.existsSync(seedPath)) throw new Error('Seed migration missing');
    const sql = fs.readFileSync(seedPath, 'utf8');

    if (!sql.includes('INSERT INTO public.users')) throw new Error('Missing users seed');
    if (!sql.includes('INSERT INTO public.policies')) throw new Error('Missing policies seed');
    if (!sql.includes('INSERT INTO public.rules')) throw new Error('Missing rules seed');
    if (!sql.includes('INSERT INTO public.logs')) throw new Error('Missing logs seed');
    if (!sql.includes('INSERT INTO public.violations')) throw new Error('Missing violations seed');
  });

  // --- 2. Auth & Cryptographic Parity Tests ---
  const authModule = await import('../../supabase/functions/_shared/auth.ts');

  await test('Missing JWT_SECRET fails safely without fallback', async () => {
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      authModule.getJwtSecretKey();
      throw new Error('Should have thrown due to missing JWT_SECRET');
    } catch (err) {
      if (!err.message.includes('JWT_SECRET environment variable is missing')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    } finally {
      process.env.JWT_SECRET = saved || 'sentinel-test-jwt-secret-key-32-chars-long!';
    }
  });

  await test('Bcrypt password hashing and verification', async () => {
    const plain = 'SentinelPass2026!';
    const hash = authModule.hashPassword(plain);
    if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$')) {
      throw new Error(`Unexpected hash format: ${hash}`);
    }
    const match = await authModule.verifyPassword(plain, hash);
    if (!match) throw new Error('Bcrypt password should match');
    const wrongMatch = await authModule.verifyPassword('wrongPassword', hash);
    if (wrongMatch) throw new Error('Bcrypt wrong password should not match');
  });

  await test('Django PBKDF2 SHA-256 password hash verification', async () => {
    const testHash = 'pbkdf2_sha256$1000000$9AcOXEsW9QyvgY78rkYL6t$AvXx3tUvU3sBSEaYo6O7E2XkEWoYs5+wZM2J8Zchjhg=';
    const wrongMatch = await authModule.verifyPassword('invalid_pass_xyz', testHash);
    if (wrongMatch) throw new Error('Wrong password matched PBKDF2');

    // Test synthesized PBKDF2 parity with known password
    const crypto = require('crypto');
    const salt = 'customSalt123';
    const iter = 10000;
    const pwd = 'TestUserSecret!';
    const derived = crypto.pbkdf2Sync(pwd, salt, iter, 32, 'sha256').toString('base64');
    const synthHash = `pbkdf2_sha256$${iter}$${salt}$${derived}`;

    const match = await authModule.verifyPassword(pwd, synthHash);
    if (!match) throw new Error('Synthesized PBKDF2 did not verify correctly');
  });

  await test('JWT Token Generation and Verification', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'sentinel-test-jwt-secret-key-32-chars-long!';
    const user = { id: 42, sqlite_id: 42, username: 'compliance_lead', role: 'admin' };
    const { access, refresh } = await authModule.generateTokens(user);
    if (!access || !refresh) throw new Error('Tokens were not generated');

    const decoded = await authModule.verifyToken(access);
    if (!decoded || decoded.username !== 'compliance_lead' || decoded.role !== 'admin') {
      throw new Error('Decoded token payload does not match');
    }

    const invalid = await authModule.verifyToken('invalid.jwt.token');
    if (invalid !== null) throw new Error('Invalid token should return null');
  });

  await test('requireRole RBAC helper grants and denies correctly', async () => {
    const employee = { id: 1, username: 'alice', role: 'employee' };
    const compliance = { id: 2, username: 'bob', role: 'compliance_officer' };
    const admin = { id: 3, username: 'charlie', role: 'admin' };

    // Employee blocked from compliance action
    const empDeny = authModule.requireRole(employee, ['compliance_officer', 'admin'], 'manage policies');
    if (!empDeny || empDeny.status !== 403) throw new Error('Employee should receive 403');

    // Compliance officer allowed
    const compAllow = authModule.requireRole(compliance, ['compliance_officer', 'admin'], 'manage policies');
    if (compAllow !== null) throw new Error('Compliance officer should be allowed');

    // Admin allowed
    const adminAllow = authModule.requireRole(admin, ['compliance_officer', 'admin'], 'manage policies');
    if (adminAllow !== null) throw new Error('Admin should be allowed');

    // Null user yields 401
    const unauth = authModule.requireRole(null, ['admin'], 'manage users');
    if (!unauth || unauth.status !== 401) throw new Error('Null user should receive 401');
  });

  // --- 3. Rule Engine Tests ---
  const ruleModule = await import('../../supabase/functions/_shared/ruleEngine.ts');

  await test('Rule Engine keyword severity classification', async () => {
    if (ruleModule.severityFromText('Employee leaked confidential customer data') !== 'Critical') {
      throw new Error('Confidential customer data should be Critical');
    }
    if (ruleModule.severityFromText('Exported logs to usb device') !== 'High') {
      throw new Error('Exported logs to usb should be High');
    }
    if (ruleModule.severityFromText('Late report retry warning') !== 'Medium') {
      throw new Error('Late retry should be Medium');
    }
    if (ruleModule.severityFromText('Normal routine check') !== 'Low') {
      throw new Error('Normal activity should be Low');
    }
  });

  await test('Rule Engine severity to status mapping', async () => {
    if (ruleModule.statusFromSeverity('Critical') !== 'Open') throw new Error('Critical status');
    if (ruleModule.statusFromSeverity('High') !== 'Investigating') throw new Error('High status');
    if (ruleModule.statusFromSeverity('Medium') !== 'Queued') throw new Error('Medium status');
    if (ruleModule.statusFromSeverity('Low') !== 'Observed') throw new Error('Low status');
  });

  await test('Rule Engine rule matching heuristic', async () => {
    const rule = {
      description: 'Customer financial records must be stored securely',
      condition: 'financial records',
      action: 'Ensure encrypted transmission',
    };
    if (!ruleModule.ruleMatchesAction(rule, 'Accessed financial records without 2FA')) {
      throw new Error('Condition match failed');
    }
    if (!ruleModule.ruleMatchesAction(rule, 'Customer record access')) {
      throw new Error('Keyword match failed');
    }
  });

  await test('Rule Engine heuristic rule extraction and interpreter response', async () => {
    const policyText = 'All employees must report security incidents immediately. Personal USB drives are strictly forbidden.';
    const rules = await ruleModule.aiRules(policyText);
    if (rules.length === 0) throw new Error('Expected extracted rules');

    const response = ruleModule.buildInterpreterResponse('Security Policy', 'manual', policyText, rules);
    if (!response.title || response.actions.length === 0) {
      throw new Error('Invalid interpreter response');
    }
    if (response.complexity_label !== 'Low') {
      throw new Error(`Expected complexity Low, got ${response.complexity_label}`);
    }
  });

  // --- 4. Document Parser Tests ---
  const docModule = await import('../../supabase/functions/_shared/documentParser.ts');

  await test('Document Parser extracts plain text correctly', async () => {
    const bytes = new TextEncoder().encode('Hello compliance world');
    const text = await docModule.extractTextFromBytes(bytes, 'sample.txt');
    if (text !== 'Hello compliance world') throw new Error(`Got: ${text}`);
  });

  await test('Document Parser extracts text from PDF document', async () => {
    const pdfPath = path.resolve(__dirname, '..', '..', 'backups', 'media_policies', 'google_privacy_policy_en.pdf');
    if (fs.existsSync(pdfPath)) {
      const bytes = fs.readFileSync(pdfPath);
      const text = await docModule.extractTextFromBytes(new Uint8Array(bytes), 'google_privacy_policy_en.pdf');
      if (!text.toLowerCase().includes('privacy policy') && !text.toLowerCase().includes('google')) {
        throw new Error('PDF extraction did not contain expected text');
      }
    }
  });

  // --- 5. CORS & Edge Response Tests ---
  const corsModule = await import('../../supabase/functions/_shared/cors.ts');
  const apiModule = await import('../../supabase/functions/api/index.ts');

  await test('Edge Function Router handles GET /health endpoint', async () => {
    const req = new Request('http://localhost/health', { method: 'GET' });
    const res = await apiModule.handleRequest(req);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const body = await res.json();
    if (body.status !== 'ok' || body.service !== 'sentinel-core') {
      throw new Error(`Invalid health body: ${JSON.stringify(body)}`);
    }
  });

  await test('Edge Function Router rejects non-GET methods on /health and /health/ready with 405 Method Not Allowed', async () => {
    const postHealth = new Request('http://localhost/health', { method: 'POST' });
    const resPostHealth = await apiModule.handleRequest(postHealth);
    if (resPostHealth.status !== 405) throw new Error(`Expected 405, got ${resPostHealth.status}`);

    const postReady = new Request('http://localhost/health/ready', { method: 'POST' });
    const resPostReady = await apiModule.handleRequest(postReady);
    if (resPostReady.status !== 405) throw new Error(`Expected 405, got ${resPostReady.status}`);
  });

  await test('Edge Function Router handles OPTIONS preflight', async () => {
    const req = new Request('http://localhost/api/auth/login', { method: 'OPTIONS' });
    const res = await apiModule.handleRequest(req);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await test('Edge Function Router returns 404 for unknown endpoint', async () => {
    const req = new Request('http://localhost/api/nonexistent-route-xyz', { method: 'GET' });
    const res = await apiModule.handleRequest(req);
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    const body = await res.json();
    if (!body.detail || !body.detail.includes('not found')) {
      throw new Error('Expected 404 detail message');
    }
  });

  await test('CORS handler responds to OPTIONS preflight', async () => {
    const req = new Request('http://localhost/api/test', { method: 'OPTIONS' });
    const res = corsModule.handleCors(req);
    if (!res || res.status !== 200) throw new Error('OPTIONS should return 200');
    if (!res.headers.get('Access-Control-Allow-Origin')) throw new Error('Missing CORS header');
  });

  await test('CORS origin resolver restricts untrusted origins when configured', async () => {
    const saved = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = 'https://sentinel-core.vercel.app';
    try {
      const untrustedReq = new Request('http://localhost/api/test', {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil-phishing-site.com' },
      });
      const res = corsModule.handleCors(untrustedReq);
      const originHeader = res.headers.get('Access-Control-Allow-Origin');
      if (originHeader === 'https://evil-phishing-site.com' || originHeader === '*') {
        throw new Error(`Untrusted origin was allowed: ${originHeader}`);
      }
      if (originHeader !== 'https://sentinel-core.vercel.app') {
        throw new Error(`Expected primary allowed origin fallback, got: ${originHeader}`);
      }

      // Trusted origin is allowed
      const trustedReq = new Request('http://localhost/api/test', {
        method: 'OPTIONS',
        headers: { Origin: 'https://sentinel-core.vercel.app' },
      });
      const resTrusted = corsModule.handleCors(trustedReq);
      if (resTrusted.headers.get('Access-Control-Allow-Origin') !== 'https://sentinel-core.vercel.app') {
        throw new Error('Trusted origin was not reflected');
      }

      // Local dev origin is allowed
      const devReq = new Request('http://localhost/api/test', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:5173' },
      });
      const resDev = corsModule.handleCors(devReq);
      if (resDev.headers.get('Access-Control-Allow-Origin') !== 'http://localhost:5173') {
        throw new Error('Local dev origin was not reflected');
      }
    } finally {
      if (saved) process.env.ALLOWED_ORIGINS = saved;
      else delete process.env.ALLOWED_ORIGINS;
    }
  });

  await test('Legacy Express authMiddleware fails safely without fallback secret', async () => {
    const expressAuth = require('../middleware/authMiddleware');
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      expressAuth.getJwtSecret();
      throw new Error('Expected getJwtSecret to throw when JWT_SECRET is unset');
    } catch (err) {
      if (!err.message.includes('JWT_SECRET environment variable is missing')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    } finally {
      process.env.JWT_SECRET = saved || 'sentinel-test-jwt-secret-key-32-chars-long!';
    }
  });

  await test('jsonResponse and errorResponse output standard format', async () => {
    const okRes = corsModule.jsonResponse({ foo: 'bar' }, 201);
    if (okRes.status !== 201) throw new Error('Expected status 201');
    const okJson = await okRes.json();
    if (okJson.foo !== 'bar') throw new Error('Expected foo: bar');

    const errRes = corsModule.errorResponse('Unauthorized access', 401);
    if (errRes.status !== 401) throw new Error('Expected status 401');
    const errJson = await errRes.json();
    if (errJson.detail !== 'Unauthorized access') throw new Error('Expected detail: Unauthorized access');
  });

  // --- 6. Edge Function Router Anonymous Access Hardening Tests ---
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock-sentinel.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key-xyz';

  const protectedEndpoints = [
    { method: 'GET', path: 'http://localhost/api/site-data' },
    { method: 'GET', path: 'http://localhost/api/dashboard' },
    { method: 'GET', path: 'http://localhost/api/policies' },
    { method: 'GET', path: 'http://localhost/api/policies/1' },
    { method: 'GET', path: 'http://localhost/api/policies/1/download' },
    { method: 'POST', path: 'http://localhost/api/policy-interpreter' },
    { method: 'POST', path: 'http://localhost/api/policies/save' },
    { method: 'POST', path: 'http://localhost/api/alerts/1/resolve' },
    { method: 'POST', path: 'http://localhost/api/alerts/1/keep-pending' },
    { method: 'POST', path: 'http://localhost/api/activity-demo' },
    { method: 'GET', path: 'http://localhost/api/logs' },
    { method: 'POST', path: 'http://localhost/api/logs' },
    { method: 'GET', path: 'http://localhost/api/violations' },
    { method: 'GET', path: 'http://localhost/api/auth/me' },
    { method: 'PUT', path: 'http://localhost/api/auth/profile' },
    { method: 'GET', path: 'http://localhost/api/users' },
    { method: 'PUT', path: 'http://localhost/api/users/1' },
    { method: 'DELETE', path: 'http://localhost/api/policies/1' },
    { method: 'PUT', path: 'http://localhost/api/policies/1' },
  ];

  for (const ep of protectedEndpoints) {
    await test(`Anonymous request to ${ep.method} ${new URL(ep.path).pathname} returns 401 Unauthorized`, async () => {
      const req = new Request(ep.path, { method: ep.method });
      const res = await apiModule.handleRequest(req);
      if (res.status !== 401) {
        throw new Error(`Expected HTTP 401, got ${res.status}`);
      }
      const data = await res.json();
      if (!data.detail) {
        throw new Error('Expected 401 response to include error detail message');
      }
    });
  }

  // --- Mock Supabase Client Helper ---
  function createMockSupabaseClient({
    users = [],
    policies = [],
    rules = [],
    logs = [],
    violations = [],
    onInsert = {},
    onUpdate = {},
  } = {}) {
    const insertedData = {};
    const updatedData = {};
    let lastQuery = null;

    const client = {
      _inserted: insertedData,
      _updated: updatedData,
      getLastQuery: () => lastQuery,
      from: (table) => {
        let filterCol = null;
        let filterVal = null;
        let orClause = null;
        let orderCol = null;

        const chain = {
          select: (cols) => chain,
          ilike: (col, val) => {
            filterCol = col;
            filterVal = val;
            return chain;
          },
          eq: (col, val) => {
            filterCol = col;
            filterVal = val;
            return chain;
          },
          neq: () => chain,
          or: (clause) => {
            orClause = clause;
            return chain;
          },
          order: (col) => {
            orderCol = col;
            return chain;
          },
          limit: () => chain,
          single: async () => {
            if (table === 'users') {
              const found = users.find(
                (u) =>
                  (filterCol && u[filterCol] == filterVal) ||
                  u.id == filterVal ||
                  u.sqlite_id == filterVal ||
                  u.username === filterVal
              );
              return { data: found || null, error: found ? null : { message: 'Not found' } };
            }
            if (table === 'policies') {
              const found = policies.find((p) => p.id == filterVal || p.sqlite_id == filterVal);
              return { data: found || null, error: found ? null : { message: 'Not found' } };
            }
            if (table === 'violations') {
              const found = violations.find((v) => v.id == filterVal || v.sqlite_id == filterVal);
              return { data: found || null, error: found ? null : { message: 'Not found' } };
            }
            return { data: null, error: { message: 'Not found' } };
          },
          maybeSingle: async () => {
            if (table === 'users') {
              const found = users.find(
                (u) =>
                  (filterCol &&
                    u[filterCol] &&
                    String(u[filterCol]).toLowerCase() === String(filterVal || '').toLowerCase()) ||
                  u.id == filterVal ||
                  u.sqlite_id == filterVal ||
                  (orClause && (orClause.includes(`id.eq.${u.id}`) || orClause.includes(`sqlite_id.eq.${u.sqlite_id}`)))
              );
              return { data: found || null, error: null };
            }
            if (table === 'policies') {
              const found = policies.find(
                (p) =>
                  p.id == filterVal ||
                  p.sqlite_id == filterVal ||
                  (orClause && (orClause.includes(`id.eq.${p.id}`) || orClause.includes(`sqlite_id.eq.${p.sqlite_id}`)))
              );
              return { data: found || null, error: null };
            }
            if (table === 'violations') {
              const found = violations.find(
                (v) =>
                  v.id == filterVal ||
                  v.sqlite_id == filterVal ||
                  (orClause && (orClause.includes(`id.eq.${v.id}`) || orClause.includes(`sqlite_id.eq.${v.sqlite_id}`)))
              );
              return { data: found || null, error: null };
            }
            return { data: null, error: null };
          },
          insert: (record) => {
            insertedData[table] = record;
            if (onInsert[table]) onInsert[table](record);
            const saved = { id: 99, sqlite_id: 99, ...record };
            return {
              select: () => ({
                single: async () => ({ data: saved, error: null }),
              }),
              then: (resolve) => resolve({ data: [saved], error: null }),
            };
          },
          update: (record) => {
            updatedData[table] = record;
            if (onUpdate[table]) onUpdate[table](record);
            return {
              eq: (col, val) => {
                filterCol = col;
                filterVal = val;
                const found = users.find((u) => u.id == val || u.sqlite_id == val) || {};
                const merged = { ...found, ...record, id: val, sqlite_id: val };
                return {
                  select: () => ({
                    single: async () => ({ data: merged, error: null }),
                  }),
                };
              },
            };
          },
          delete: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: null, error: null }),
              then: (resolve) => resolve({ data: null, error: null }),
            }),
            then: (resolve) => resolve({ data: null, error: null }),
          }),
          then: (resolve) => {
            lastQuery = { table, orClause, orderCol };
            if (table === 'logs') {
              resolve({ data: logs, error: null });
            } else if (table === 'violations') {
              resolve({ data: violations, error: null });
            } else if (table === 'policies') {
              resolve({ data: policies, error: null });
            } else if (table === 'rules') {
              resolve({ data: rules, error: null });
            } else if (table === 'users') {
              resolve({ data: users, error: null });
            } else {
              resolve({ data: [], error: null });
            }
          },
        };
        return chain;
      },
      storage: {
        from: (bucket) => ({
          createSignedUrl: async (docPath, expiresIn) => {
            return {
              data: {
                signedUrl: `https://storage.mock/${bucket}/${docPath}?token=signed_token&exp=${expiresIn}`,
              },
              error: null,
            };
          },
          remove: async (paths) => ({ data: paths, error: null }),
        }),
      },
    };
    return client;
  }

  // Import domain modules for unit testing
  const authDomain = await import('../../supabase/functions/api/domains/auth.ts');
  const policiesDomain = await import('../../supabase/functions/api/domains/policies.ts');
  const monitoringDomain = await import('../../supabase/functions/api/domains/monitoring.ts');
  const logsDomain = await import('../../supabase/functions/api/domains/logs.ts');
  const violationsDomain = await import('../../supabase/functions/api/domains/violations.ts');

  // --- 7. RBAC & Role Enforcement on Operations ---
  const employeeUser = { id: 101, sqlite_id: 101, username: 'emp_dan', role: 'employee' };
  const complianceUser = { id: 102, sqlite_id: 102, username: 'comp_eve', role: 'compliance_officer' };
  const adminUser = { id: 103, sqlite_id: 103, username: 'adm_frank', role: 'admin' };

  const { access: empToken } = await authModule.generateTokens(employeeUser);
  const { access: compToken } = await authModule.generateTokens(complianceUser);
  const { access: adminToken } = await authModule.generateTokens(adminUser);

  const mockDbWithUsers = createMockSupabaseClient({
    users: [employeeUser, complianceUser, adminUser],
    policies: [{ id: 1, sqlite_id: 1, title: 'Data Privacy', document: 'policies/privacy.pdf' }],
  });

  await test('Employee role receives HTTP 403 on Alert Resolution', async () => {
    const req = new Request('http://localhost/api/alerts/1/resolve', {
      method: 'POST',
      headers: { Authorization: `Bearer ${empToken}` },
    });
    const res = await monitoringDomain.handleResolveAlert(req, '1', mockDbWithUsers);
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  });

  await test('Employee role receives HTTP 403 on Keep Alert Pending', async () => {
    const req = new Request('http://localhost/api/alerts/1/keep-pending', {
      method: 'POST',
      headers: { Authorization: `Bearer ${empToken}` },
    });
    const res = await monitoringDomain.handleKeepAlertPending(req, '1', mockDbWithUsers);
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  });

  await test('Employee role receives HTTP 403 on Activity Simulation', async () => {
    const req = new Request('http://localhost/api/activity-demo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${empToken}` },
    });
    const res = await monitoringDomain.handleRecordActivityDemo(req, mockDbWithUsers);
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  });

  await test('Employee role receives HTTP 403 on Policy Interpretation', async () => {
    const req = new Request('http://localhost/api/policy-interpreter', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${empToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Test', policy_text: 'Strict access rules.' }),
    });
    const res = await policiesDomain.handleInterpretPolicy(req, mockDbWithUsers);
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  });

  await test('Employee role receives HTTP 403 on Policy Save', async () => {
    const req = new Request('http://localhost/api/policies/save', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${empToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Test', policy_text: 'Strict access rules.' }),
    });
    const res = await policiesDomain.handleSavePolicy(req, mockDbWithUsers);
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  });

  await test('Employee role receives HTTP 403 on Violations List', async () => {
    const req = new Request('http://localhost/api/violations', {
      method: 'GET',
      headers: { Authorization: `Bearer ${empToken}` },
    });
    const res = await violationsDomain.handleGetViolations(req, mockDbWithUsers);
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  });

  await test('Compliance Officer role passes RBAC check on violations & simulation', async () => {
    const reqVio = new Request('http://localhost/api/violations', {
      method: 'GET',
      headers: { Authorization: `Bearer ${compToken}` },
    });
    const resVio = await violationsDomain.handleGetViolations(reqVio, mockDbWithUsers);
    if (resVio.status === 403 || resVio.status === 401) {
      throw new Error(`Expected RBAC pass for compliance officer, got status ${resVio.status}`);
    }
  });

  // --- 8. Role Tampering & Registration Escalation Tests ---
  await test('Public registration hardcodes role to employee and rejects privilege escalation', async () => {
    const client = createMockSupabaseClient({ users: [] });
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'sneaky_hacker',
        password: 'password123',
        role: 'admin', // Attacker attempts to register directly as admin
        email: 'hacker@sentinel.local',
      }),
    });

    const res = await authDomain.handleRegister(req, client);
    if (res.status !== 201) throw new Error(`Expected 201 Created, got ${res.status}`);

    const inserted = client._inserted.users;
    if (!inserted) throw new Error('No user record inserted');
    if (inserted.role !== 'employee') {
      throw new Error(`Role tampering vulnerability! Assigned role was: ${inserted.role}`);
    }
  });

  // --- 9. Profile Update Role Protection Tests ---
  await test('Employee user cannot modify their own role via profile update', async () => {
    const client = createMockSupabaseClient({
      users: [employeeUser],
    });
    const req = new Request('http://localhost/api/auth/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${empToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        first_name: 'Dan',
        role: 'admin', // Employee attempts to promote themselves to admin
      }),
    });

    const res = await authDomain.handleUpdateProfile(req, client);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

    const updated = client._updated.users;
    if (!updated) throw new Error('No user updated');
    if (updated.role !== undefined) {
      throw new Error(`Role escalation vulnerability! Employee changed role to: ${updated.role}`);
    }
    if (updated.first_name !== 'Dan') {
      throw new Error('Expected first_name to update');
    }
  });

  await test('Administrator CAN modify roles via profile update', async () => {
    const client = createMockSupabaseClient({
      users: [adminUser],
    });
    const req = new Request('http://localhost/api/auth/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'compliance_officer',
      }),
    });

    const res = await authDomain.handleUpdateProfile(req, client);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

    const updated = client._updated.users;
    if (!updated || updated.role !== 'compliance_officer') {
      throw new Error('Admin should be able to modify roles');
    }
  });

  // --- Admin User Management & Role Administration Tests ---
  await test('Employee role receives HTTP 403 on User List', async () => {
    const req = new Request('http://localhost/api/users', {
      method: 'GET',
      headers: { Authorization: `Bearer ${empToken}` },
    });
    const res = await authDomain.handleGetUsers(req, mockDbWithUsers);
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  });

  await test('Compliance Officer role receives HTTP 403 on User List', async () => {
    const req = new Request('http://localhost/api/users', {
      method: 'GET',
      headers: { Authorization: `Bearer ${compToken}` },
    });
    const res = await authDomain.handleGetUsers(req, mockDbWithUsers);
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  });

  await test('Administrator receives HTTP 200 on User List', async () => {
    const req = new Request('http://localhost/api/users', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const res = await authDomain.handleGetUsers(req, mockDbWithUsers);
    if (res.status !== 200) throw new Error(`Expected 200 OK, got ${res.status}`);
    const usersList = await res.json();
    if (!Array.isArray(usersList) || usersList.length === 0) {
      throw new Error('Expected user list array');
    }
  });

  await test('Employee role receives HTTP 403 on User Update', async () => {
    const req = new Request('http://localhost/api/users/2', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${empToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'compliance_officer' }),
    });
    const res = await authDomain.handleUpdateUser(req, '2', mockDbWithUsers);
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  });

  await test('Administrator CAN update another user role via PUT /api/users/:id', async () => {
    const client = createMockSupabaseClient({
      users: [adminUser, employeeUser],
    });
    const req = new Request('http://localhost/api/users/101', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'compliance_officer' }),
    });
    const res = await authDomain.handleUpdateUser(req, '101', client);
    if (res.status !== 200) throw new Error(`Expected 200 OK, got ${res.status}`);
    const updated = client._updated.users;
    if (!updated || updated.role !== 'compliance_officer') {
      throw new Error('Expected user role to be updated to compliance_officer');
    }
  });

  await test('Administrator cannot deactivate or demote their own account via user management', async () => {
    const client = createMockSupabaseClient({
      users: [adminUser],
    });
    // Test 1: Self-demotion rejected
    const reqDemote = new Request('http://localhost/api/users/103', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'employee' }),
    });
    const resDemote = await authDomain.handleUpdateUser(reqDemote, '103', client);
    if (resDemote.status !== 400) throw new Error(`Expected 400 on self-demotion, got ${resDemote.status}`);

    // Test 2: Self-deactivation rejected
    const reqDeact = new Request('http://localhost/api/users/103', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_active: false }),
    });
    const resDeact = await authDomain.handleUpdateUser(reqDeact, '103', client);
    if (resDeact.status !== 400) throw new Error(`Expected 400 on self-deactivation, got ${resDeact.status}`);
  });

  // --- Policy Management (Update & Delete) Tests ---
  await test('Employee role receives HTTP 403 on Policy Deletion', async () => {
    const req = new Request('http://localhost/api/policies/1', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${empToken}` },
    });
    const res = await policiesDomain.handleDeletePolicy(req, '1', mockDbWithUsers);
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  });

  await test('Administrator / Compliance Officer CAN delete policy via DELETE /api/policies/:id', async () => {
    const samplePolicy = { id: 5, sqlite_id: 5, title: 'Obsolete Policy', document: 'policies/old.pdf' };
    const client = createMockSupabaseClient({
      users: [adminUser],
      policies: [samplePolicy],
    });
    const req = new Request('http://localhost/api/policies/5', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const res = await policiesDomain.handleDeletePolicy(req, '5', client);
    if (res.status !== 200) throw new Error(`Expected 200 OK, got ${res.status}`);
    const data = await res.json();
    if (!data.detail || !data.detail.includes('deleted successfully')) {
      throw new Error('Expected deletion confirmation message');
    }
  });

  await test('Administrator / Compliance Officer CAN update policy via PUT /api/policies/:id', async () => {
    const samplePolicy = { id: 5, sqlite_id: 5, title: 'Old Title', content_text: 'Old text' };
    const client = createMockSupabaseClient({
      users: [adminUser],
      policies: [samplePolicy],
    });
    const req = new Request('http://localhost/api/policies/5', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'New Updated Title', content_text: 'Strict access rules.' }),
    });
    const res = await policiesDomain.handleUpdatePolicy(req, '5', client);
    if (res.status !== 200) throw new Error(`Expected 200 OK, got ${res.status}`);
    const data = await res.json();
    if (data.title !== 'New Updated Title') {
      throw new Error(`Expected updated title, got ${data.title}`);
    }
  });

  // --- 10. Record Ownership on Logs Tests ---
  await test('Employee log creation forces authenticated identity and ignores spoofed user_id', async () => {
    const client = createMockSupabaseClient({
      users: [employeeUser],
    });
    const req = new Request('http://localhost/api/logs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${empToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'Exported proprietary dataset',
        user_id: 9999, // Attempted spoof of another user ID
        username: 'innocent_colleague', // Attempted spoof of another username
      }),
    });

    const res = await logsDomain.handleCreateLog(req, client);
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);

    const inserted = client._inserted.logs;
    if (!inserted) throw new Error('Log was not inserted');
    if (inserted.user_id !== employeeUser.id) {
      throw new Error(`User ID spoofed! Expected ${employeeUser.id}, got ${inserted.user_id}`);
    }
    if (inserted.username !== employeeUser.username) {
      throw new Error(`Username spoofed! Expected ${employeeUser.username}, got ${inserted.username}`);
    }
  });

  await test('Employee log query enforces record ownership filtering', async () => {
    const client = createMockSupabaseClient({
      users: [employeeUser],
      logs: [],
    });
    const req = new Request('http://localhost/api/logs', {
      method: 'GET',
      headers: { Authorization: `Bearer ${empToken}` },
    });

    const res = await logsDomain.handleGetLogs(req, client);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

    const last = client.getLastQuery();
    if (!last || !last.orClause) {
      throw new Error('Employee query did not apply ownership filter!');
    }
    if (!last.orClause.includes(`user_id.eq.${employeeUser.id}`) || !last.orClause.includes(`username.eq.${employeeUser.username}`)) {
      throw new Error(`Ownership filter missing expected employee criteria: ${last.orClause}`);
    }
  });

  // --- 11. Document Upload & Download Protection Tests ---
  await test('Policy interpreter enforces 10MB upload ceiling', async () => {
    const largeBytes = new Uint8Array(11 * 1024 * 1024); // 11MB file
    const boundary = '----WebKitFormBoundarySentinelTest';
    const bodyStr = `--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nBig Policy\r\n--${boundary}\r\nContent-Disposition: form-data; name="policy_file"; filename="huge.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
    const endStr = `\r\n--${boundary}--\r\n`;

    const encodedBody = Buffer.concat([
      Buffer.from(bodyStr),
      Buffer.from(largeBytes),
      Buffer.from(endStr),
    ]);

    const req = new Request('http://localhost/api/policy-interpreter', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${compToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: encodedBody,
    });

    const res = await policiesDomain.handleInterpretPolicy(req, mockDbWithUsers);
    if (res.status !== 400) throw new Error(`Expected 400 Bad Request for oversized file, got ${res.status}`);
    const data = await res.json();
    if (!data.detail.includes('10MB limit')) {
      throw new Error(`Expected 10MB limit error message, got: ${data.detail}`);
    }
  });

  await test('Policy document download endpoint requires auth and generates signed URL', async () => {
    // 1. Unauthenticated download rejected
    const unauthReq = new Request('http://localhost/api/policies/1/download', { method: 'GET' });
    const unauthRes = await policiesDomain.handleDownloadPolicyDocument(unauthReq, '1', mockDbWithUsers);
    if (unauthRes.status !== 401) throw new Error('Unauthenticated download should return 401');

    // 2. Authenticated user receives signed URL with 3600s expiration
    const authReq = new Request('http://localhost/api/policies/1/download', {
      method: 'GET',
      headers: { Authorization: `Bearer ${empToken}` },
    });
    const authRes = await policiesDomain.handleDownloadPolicyDocument(authReq, '1', mockDbWithUsers);
    if (authRes.status !== 200) throw new Error(`Expected 200, got ${authRes.status}`);
    const body = await authRes.json();
    if (!body.download_url || !body.download_url.includes('signed_token')) {
      throw new Error('Missing signed download URL');
    }
    if (body.expires_in !== 3600) {
      throw new Error(`Expected 3600s expiry, got ${body.expires_in}`);
    }
  });

  await test('Policy document download rejects path traversal and out-of-boundary paths', async () => {
    const maliciousPolicy = {
      id: 99,
      sqlite_id: 99,
      title: 'Malicious Policy',
      document: '../../etc/shadow',
    };
    const mockDb = createMockSupabaseClient({
      users: [adminUser],
      policies: [maliciousPolicy],
    });

    const req = new Request('http://localhost/api/policies/99/download', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const res = await policiesDomain.handleDownloadPolicyDocument(req, '99', mockDb);
    if (res.status !== 400) throw new Error(`Expected 400 Bad Request for path traversal, got ${res.status}`);
    const data = await res.json();
    if (!data.detail || !data.detail.includes('Invalid policy document path')) {
      throw new Error(`Expected invalid path detail, got: ${JSON.stringify(data)}`);
    }
  });

  await test('Deactivated user account is rejected with HTTP 403 on authentication', async () => {
    const deactivatedUser = { id: 201, sqlite_id: 201, username: 'inactive_dave', role: 'employee', is_active: false };
    const { access: inactiveToken } = await authModule.generateTokens(deactivatedUser);
    const mockDbWithInactive = createMockSupabaseClient({
      users: [deactivatedUser],
    });

    const req = new Request('http://localhost/api/logs', {
      method: 'GET',
      headers: { Authorization: `Bearer ${inactiveToken}` },
    });
    const res = await logsDomain.handleGetLogs(req, mockDbWithInactive);
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden for deactivated user, got ${res.status}`);
    const data = await res.json();
    if (!data.detail || !data.detail.includes('deactivated')) {
      throw new Error(`Expected deactivated detail message, got: ${JSON.stringify(data)}`);
    }
  });

  await test('Deactivated user account is rejected with HTTP 403 on login', async () => {
    const rawPass = 'Secret123456!';
    const hashedPass = authModule.hashPassword(rawPass);
    const deactivatedUser = {
      id: 202,
      sqlite_id: 202,
      username: 'inactive_lisa',
      password: hashedPass,
      role: 'employee',
      is_active: false,
    };
    const mockDb = createMockSupabaseClient({
      users: [deactivatedUser],
    });

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'inactive_lisa', password: rawPass }),
    });

    const res = await authDomain.handleLogin(req, mockDb);
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden for deactivated user login, got ${res.status}`);
    const data = await res.json();
    if (!data.detail || !data.detail.includes('deactivated')) {
      throw new Error(`Expected deactivated detail message, got: ${JSON.stringify(data)}`);
    }
  });

  await test('Seed sentinel data migration deactivates all historical test accounts', async () => {
    const seedPath = path.resolve(__dirname, '..', '..', 'supabase', 'migrations', '20261027000001_seed_sentinel_data.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');

    const testUsers = [
      'testuser_1792974909657',
      'testuser_1792975676526',
      'testuser_1792978916827',
      'testuser_1792981218637',
      'testuser_1793074536784',
      'testuser_1793077987487',
      'testuser_1793079271149',
      'testuser_1793079307562',
    ];

    for (const u of testUsers) {
      if (!sql.includes(`'${u}'`)) throw new Error(`Missing expected test user ${u}`);
      const regex = new RegExp(`'${u}',\\s*'[^']+',\\s*'compliance_officer',\\s*'[^']*',\\s*'[^']*',\\s*'[^']*',\\s*FALSE`);
      if (!regex.test(sql)) {
        throw new Error(`Test user ${u} is not deactivated in seed migration!`);
      }
    }
  });

  // --- 12. Frontend Authorization & Role Helpers Inspection ---
  await test('Frontend api.js defines and exports role helpers', async () => {
    const apiJsPath = path.resolve(__dirname, '..', '..', 'client', 'src', 'services', 'api.js');
    if (!fs.existsSync(apiJsPath)) throw new Error('api.js missing');
    const content = fs.readFileSync(apiJsPath, 'utf8');

    if (!content.includes('getStoredRole')) throw new Error('Missing getStoredRole export');
    if (!content.includes('isComplianceOrAdmin')) throw new Error('Missing isComplianceOrAdmin export');
    if (!content.includes('isAdmin')) throw new Error('Missing isAdmin export');
    if (!content.includes('sentinel_user_role')) throw new Error('Missing sentinel_user_role storage');
  });

  await test('Frontend MonitoringPage gates alert resolution and simulation', async () => {
    const pagePath = path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'MonitoringPage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');
    if (!content.includes('isComplianceOrAdmin()')) {
      throw new Error('MonitoringPage does not check isComplianceOrAdmin()');
    }
    if (!content.includes('Simulation Restricted (Compliance/Admin)')) {
      throw new Error('MonitoringPage does not indicate restricted simulation');
    }
  });

  await test('Frontend SettingsPage disables role input for non-admins', async () => {
    const pagePath = path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'SettingsPage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');
    if (!content.includes("disabled={getStoredRole() !== 'admin'}")) {
      throw new Error('SettingsPage does not disable role input for non-admin');
    }
  });

  await test('Frontend PoliciesPage disables analysis and save for non-compliance users', async () => {
    const pagePath = path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'PoliciesPage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');
    if (!content.includes('isComplianceOrAdmin()')) {
      throw new Error('PoliciesPage does not check isComplianceOrAdmin()');
    }
  });

  await test('Frontend DashboardPage gates alert triage for non-compliance users', async () => {
    const pagePath = path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'DashboardPage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');
    if (!content.includes('isComplianceOrAdmin()')) {
      throw new Error('DashboardPage does not check isComplianceOrAdmin()');
    }
    if (!content.includes('Triage restricted to Compliance / Admin')) {
      throw new Error('DashboardPage does not indicate restricted triage for employees');
    }
  });

  await test('Frontend LoginPage connects credential autofill buttons', async () => {
    const pagePath = path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'LoginPage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');
    if (!content.includes('onClick={fillAdminAccount}')) {
      throw new Error('LoginPage does not bind onClick={fillAdminAccount}');
    }
    if (!content.includes('onClick={fillEmployeeAccount}')) {
      throw new Error('LoginPage does not bind onClick={fillEmployeeAccount}');
    }
  });

  await test('Frontend SettingsPage includes User Management interface for administrators', async () => {
    const pagePath = path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'SettingsPage.jsx');
    const content = fs.readFileSync(pagePath, 'utf8');
    if (!content.includes('isAdmin()')) {
      throw new Error('SettingsPage does not check isAdmin() for user management');
    }
    if (!content.includes('/api/users/')) {
      throw new Error('SettingsPage does not request /api/users/');
    }
  });

  await test('Frontend api.js validates API base URLs and rejects placeholders', async () => {
    const apiJsPath = path.resolve(__dirname, '..', '..', 'client', 'src', 'services', 'api.js');
    const content = fs.readFileSync(apiJsPath, 'utf8');

    // 1. Verify required functions are exported
    if (!content.includes('export const validateApiBaseUrl')) throw new Error('Missing validateApiBaseUrl export');
    if (!content.includes('export const validateAnonKey')) throw new Error('Missing validateAnonKey export');
    if (!content.includes('export const resolveApiBaseUrl')) throw new Error('Missing resolveApiBaseUrl export');
    if (!content.includes('export const resolveAnonKey')) throw new Error('Missing resolveAnonKey export');
    if (!content.includes('export const checkApiConfiguration')) throw new Error('Missing checkApiConfiguration export');

    // 2. Verify NO hardcoded anon key exists in api.js
    if (content.includes('PRODUCTION_SUPABASE_ANON_KEY') || content.includes('sb_publishable_aqeP6F6QCf')) {
      throw new Error('Hardcoded PRODUCTION_SUPABASE_ANON_KEY or key fallback still exists in api.js');
    }

    // 3. Import and functionally test the validation logic
    const { validateApiBaseUrl, validateAnonKey, resolveApiBaseUrl, resolveAnonKey } = await import('../../client/src/services/api.js');

    // Test missing / empty API URLs
    if (validateApiBaseUrl('').isValid !== false) throw new Error('Expected empty API URL to be invalid');
    if (validateApiBaseUrl(null).isValid !== false) throw new Error('Expected null API URL to be invalid');
    if (validateApiBaseUrl(undefined).isValid !== false) throw new Error('Expected undefined API URL to be invalid');

    // Test placeholder API URLs
    const placeholders = [
      'https://your_project_ref.supabase.co/functions/v1/api',
      'https://your-project-ref.supabase.co/functions/v1/api',
      'https://<your-project-ref>.supabase.co/functions/v1/api',
      'https://placeholder.supabase.co/functions/v1/api',
      'https://example.com/api',
    ];
    for (const ph of placeholders) {
      const res = validateApiBaseUrl(ph);
      if (res.isValid !== false || res.reason !== 'placeholder') {
        throw new Error(`Expected placeholder URL ${ph} to be flagged as invalid placeholder`);
      }
      if (resolveApiBaseUrl(ph) !== '') {
        throw new Error(`Expected resolveApiBaseUrl to fail cleanly on placeholder ${ph}`);
      }
    }

    // Test valid API URLs and normalizations
    const validUrl = 'https://vkczojjnhmtnsgdwvxdj.supabase.co/functions/v1/api';
    if (validateApiBaseUrl(validUrl).isValid !== true) {
      throw new Error('Expected valid Supabase URL to pass validation');
    }
    if (resolveApiBaseUrl(validUrl) !== validUrl) {
      throw new Error('Expected resolveApiBaseUrl to preserve valid URL');
    }
    if (resolveApiBaseUrl(`${validUrl}/`) !== validUrl) {
      throw new Error('Expected resolveApiBaseUrl to strip trailing slash');
    }
    if (resolveApiBaseUrl('https://vkczojjnhmtnsgdwvxdj.supabase.co') !== validUrl) {
      throw new Error('Expected resolveApiBaseUrl to normalize bare Supabase domain to /functions/v1/api');
    }

    // Test Anon Key validation
    if (validateAnonKey('').isValid !== false) throw new Error('Expected empty anon key to be invalid');
    if (validateAnonKey('your_supabase_anon_public_key_here').isValid !== false) {
      throw new Error('Expected placeholder anon key to be invalid');
    }
    if (validateAnonKey('sb_publishable_test_token_valid_key').isValid !== true) {
      throw new Error('Expected valid anon key to pass validation');
    }
    if (resolveAnonKey('your_supabase_anon_public_key_here') !== '') {
      throw new Error('Expected resolveAnonKey to fail cleanly on placeholder key');
    }
    if (resolveAnonKey('sb_publishable_test_token_valid_key') !== 'sb_publishable_test_token_valid_key') {
      throw new Error('Expected resolveAnonKey to return valid key');
    }
  });

  // --- 13. Demo Accounts & Role-Based Workflows Verification ---
  await test('Seed, Monolithic Deploy, and Dedicated Provisioning Migrations configure distinct demo accounts', async () => {
    const seedPath = path.resolve(__dirname, '..', '..', 'supabase', 'migrations', '20261027000001_seed_sentinel_data.sql');
    const deployPath = path.resolve(__dirname, '..', '..', 'supabase', 'migrations', 'deploy_all_to_supabase.sql');
    const provPath = path.resolve(__dirname, '..', '..', 'supabase', 'migrations', '20261029000001_provision_demo_accounts.sql');

    if (!fs.existsSync(provPath)) throw new Error('20261029000001_provision_demo_accounts.sql migration missing');
    const provSql = fs.readFileSync(provPath, 'utf8');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    const deploySql = fs.readFileSync(deployPath, 'utf8');

    for (const sql of [provSql, seedSql, deploySql]) {
      if (!sql.includes("'demo.employee'")) throw new Error('Missing demo.employee in migration');
      if (!sql.includes("'demo.admin'")) throw new Error('Missing demo.admin in migration');
    }

    if (!provSql.includes("role = 'employee'")) throw new Error('demo.employee not set to employee role');
    if (!provSql.includes("role = 'admin'")) throw new Error('demo.admin not set to admin role');
  });

  const demoEmployeePass = 'demo1234';
  const demoAdminPass = 'adminDemo2026!';
  const demoEmpUser = {
    id: 2,
    sqlite_id: 2,
    username: 'demo.employee',
    password: authModule.hashPassword(demoEmployeePass),
    role: 'employee',
    is_active: true,
  };
  const demoAdminUser = {
    id: 12,
    sqlite_id: 12,
    username: 'demo.admin',
    password: authModule.hashPassword(demoAdminPass),
    role: 'admin',
    is_active: true,
  };

  const mockDbWithDemoAccounts = createMockSupabaseClient({
    users: [demoEmpUser, demoAdminUser],
    policies: [{ id: 1, sqlite_id: 1, title: 'Corporate Security', document: 'policies/sec.pdf', uploaded_by: 12 }],
    violations: [{ id: 1, sqlite_id: 1, user_id: 2, status: 'Open', message: 'Test breach' }],
    logs: [{ id: 1, sqlite_id: 1, user_id: 2, username: 'demo.employee', action: 'Accessed files' }],
  });

  let demoEmpAccess = null;
  let demoAdminAccess = null;

  await test('Demo Employee login succeeds and issues JWT with role employee', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo.employee', password: demoEmployeePass }),
    });
    const res = await authDomain.handleLogin(req, mockDbWithDemoAccounts);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = await res.json();
    if (data.user?.role !== 'employee') throw new Error(`Expected role employee, got: ${data.user?.role}`);
    if (!data.access || !data.refresh) throw new Error('Missing JWT tokens');
    demoEmpAccess = data.access;

    const payload = await authModule.verifyToken(data.access);
    if (payload.role !== 'employee') throw new Error(`JWT payload role is not employee: ${payload.role}`);
  });

  await test('Demo Administrator login succeeds and issues JWT with role admin', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo.admin', password: demoAdminPass }),
    });
    const res = await authDomain.handleLogin(req, mockDbWithDemoAccounts);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = await res.json();
    if (data.user?.role !== 'admin') throw new Error(`Expected role admin, got: ${data.user?.role}`);
    if (!data.access || !data.refresh) throw new Error('Missing JWT tokens');
    demoAdminAccess = data.access;

    const payload = await authModule.verifyToken(data.access);
    if (payload.role !== 'admin') throw new Error(`JWT payload role is not admin: ${payload.role}`);
  });

  await test('Demo accounts reject invalid or cross-swapped passwords with HTTP 401', async () => {
    // demo.employee with admin password
    const reqSwappedEmp = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo.employee', password: demoAdminPass }),
    });
    const resSwappedEmp = await authDomain.handleLogin(reqSwappedEmp, mockDbWithDemoAccounts);
    if (resSwappedEmp.status !== 401) throw new Error(`Expected 401, got ${resSwappedEmp.status}`);

    // demo.admin with employee password
    const reqSwappedAdmin = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo.admin', password: demoEmployeePass }),
    });
    const resSwappedAdmin = await authDomain.handleLogin(reqSwappedAdmin, mockDbWithDemoAccounts);
    if (resSwappedAdmin.status !== 401) throw new Error(`Expected 401, got ${resSwappedAdmin.status}`);
  });

  await test('Demo Employee token is rejected (HTTP 403) on administrator-only and compliance endpoints', async () => {
    const headers = { Authorization: `Bearer ${demoEmpAccess}` };

    // 1. User Management (admin only)
    const resUsers = await authDomain.handleGetUsers(new Request('http://localhost/api/users', { headers }), mockDbWithDemoAccounts);
    if (resUsers.status !== 403) throw new Error(`Expected 403 on GET /api/users, got ${resUsers.status}`);

    const resUpdateUser = await authDomain.handleUpdateUser(
      new Request('http://localhost/api/users/12', { method: 'PUT', headers, body: JSON.stringify({ role: 'admin' }) }),
      '12',
      mockDbWithDemoAccounts
    );
    if (resUpdateUser.status !== 403) throw new Error(`Expected 403 on PUT /api/users/:id, got ${resUpdateUser.status}`);

    // 2. Policy interpretation & save (compliance / admin)
    const resInterpret = await policiesDomain.handleInterpretPolicy(
      new Request('http://localhost/api/policy-interpreter', { method: 'POST', headers, body: JSON.stringify({ text: 'policy text' }) }),
      mockDbWithDemoAccounts
    );
    if (resInterpret.status !== 403) throw new Error(`Expected 403 on policy-interpreter, got ${resInterpret.status}`);

    // 3. Activity simulation (compliance / admin)
    const resSim = await monitoringDomain.handleRecordActivityDemo(
      new Request('http://localhost/api/activity-demo', { method: 'POST', headers }),
      mockDbWithDemoAccounts
    );
    if (resSim.status !== 403) throw new Error(`Expected 403 on activity-demo, got ${resSim.status}`);

    // 4. Alert triage (compliance / admin)
    const resResolve = await monitoringDomain.handleResolveAlert(
      new Request('http://localhost/api/alerts/1/resolve', { method: 'POST', headers }),
      '1',
      mockDbWithDemoAccounts
    );
    if (resResolve.status !== 403) throw new Error(`Expected 403 on alert resolve, got ${resResolve.status}`);

    // 5. Violations list (compliance / admin)
    const resViolations = await violationsDomain.handleGetViolations(
      new Request('http://localhost/api/violations', { headers }),
      mockDbWithDemoAccounts
    );
    if (resViolations.status !== 403) throw new Error(`Expected 403 on violations, got ${resViolations.status}`);
  });

  await test('Demo Administrator token has full authorization on admin and compliance endpoints', async () => {
    const headers = { Authorization: `Bearer ${demoAdminAccess}` };

    // 1. User Management (admin only)
    const resUsers = await authDomain.handleGetUsers(new Request('http://localhost/api/users', { headers }), mockDbWithDemoAccounts);
    if (resUsers.status !== 200) throw new Error(`Expected 200 on GET /api/users, got ${resUsers.status}`);

    // 2. Policy interpretation (compliance / admin)
    const resInterpret = await policiesDomain.handleInterpretPolicy(
      new Request('http://localhost/api/policy-interpreter', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Policy', policy_text: 'Valid test policy text for AI rules' }),
      }),
      mockDbWithDemoAccounts
    );
    if (resInterpret.status !== 200) throw new Error(`Expected 200 on policy-interpreter, got ${resInterpret.status}`);

    // 3. Activity simulation (compliance / admin)
    const resSim = await monitoringDomain.handleRecordActivityDemo(
      new Request('http://localhost/api/activity-demo', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee: 'demo.employee', action: 'Download records' }),
      }),
      mockDbWithDemoAccounts
    );
    if (resSim.status !== 201 && resSim.status !== 200) {
      throw new Error(`Expected 201/200 on activity-demo, got ${resSim.status}`);
    }

    // 4. Violations list (compliance / admin)
    const resViolations = await violationsDomain.handleGetViolations(
      new Request('http://localhost/api/violations', { headers }),
      mockDbWithDemoAccounts
    );
    if (resViolations.status !== 200) throw new Error(`Expected 200 on violations, got ${resViolations.status}`);
  });

  await test('Demo Employee workflows (policies, logs, profile) execute successfully', async () => {
    const headers = { Authorization: `Bearer ${demoEmpAccess}` };

    // 1. Read policies
    const resPolicies = await policiesDomain.handleGetPolicies(
      new Request('http://localhost/api/policies', { headers }),
      mockDbWithDemoAccounts
    );
    if (resPolicies.status !== 200) throw new Error(`Expected 200 on GET /api/policies, got ${resPolicies.status}`);

    // 2. Read logs
    const resLogs = await logsDomain.handleGetLogs(
      new Request('http://localhost/api/logs', { headers }),
      mockDbWithDemoAccounts
    );
    if (resLogs.status !== 200) throw new Error(`Expected 200 on GET /api/logs, got ${resLogs.status}`);

    // 3. Authenticate current user
    const resMe = await authDomain.handleGetMe(
      new Request('http://localhost/api/auth/me', { headers }),
      mockDbWithDemoAccounts
    );
    if (resMe.status !== 200) throw new Error(`Expected 200 on GET /api/auth/me, got ${resMe.status}`);
    const meData = await resMe.json();
    if (meData.username !== 'demo.employee' || meData.role !== 'employee') {
      throw new Error(`Unexpected /auth/me data: ${JSON.stringify(meData)}`);
    }
  });

  await test('Public registration strictly enforces employee role and rejects privilege escalation', async () => {
    let capturedUser = null;
    const testDb = createMockSupabaseClient({
      users: [],
      onInsert: {
        users: (u) => {
          capturedUser = u;
        },
      },
    });

    const regReq = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'malicious_user',
        password: 'password123',
        role: 'admin', // Attempted elevation
      }),
    });

    const regRes = await authDomain.handleRegister(regReq, testDb);
    if (regRes.status !== 201) throw new Error(`Expected 201 Created, got ${regRes.status}`);
    if (capturedUser?.role !== 'employee') {
      throw new Error(`Security breach: Registration allowed role ${capturedUser?.role}`);
    }
  });

  await test('Frontend demo accounts configuration and LoginPage avoid hardcoded credentials in source', async () => {
    const configPath = path.resolve(__dirname, '..', '..', 'client', 'src', 'config', 'demoAccounts.js');
    if (!fs.existsSync(configPath)) throw new Error('demoAccounts.js configuration missing');
    const configContent = fs.readFileSync(configPath, 'utf8');

    if (!configContent.includes('DEMO_ACCOUNTS')) throw new Error('Missing DEMO_ACCOUNTS export');
    if (!configContent.includes('VITE_DEMO_EMPLOYEE_PASSWORD')) throw new Error('demoAccounts.js must read VITE_DEMO_EMPLOYEE_PASSWORD');
    if (!configContent.includes('VITE_DEMO_ADMIN_PASSWORD')) throw new Error('demoAccounts.js must read VITE_DEMO_ADMIN_PASSWORD');

    const pagePath = path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'LoginPage.jsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    // Assert NO plaintext demo passwords are hardcoded in LoginPage source
    if (pageContent.includes("'123456'") || pageContent.includes('"123456"') || pageContent.includes("'demo1234'") || pageContent.includes("'adminDemo2026!'")) {
      throw new Error('Plaintext password detected in LoginPage.jsx source code!');
    }

    // Assert both distinct cards are rendered
    if (!pageContent.includes('Administrator Demo') || !pageContent.includes('Employee Demo')) {
      throw new Error('LoginPage.jsx must render distinct Administrator Demo and Employee Demo options');
    }

    // Assert autofill handlers are present and bound
    if (!pageContent.includes('onClick={fillAdminAccount}') || !pageContent.includes('onClick={fillEmployeeAccount}')) {
      throw new Error('Autofill handlers not properly bound in LoginPage.jsx');
    }
  });

  console.log('\n======================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('[Runner Error]', err);
  process.exit(1);
});
