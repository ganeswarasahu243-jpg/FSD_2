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
                  u.sqlite_id == filterVal
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
