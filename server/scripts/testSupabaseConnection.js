const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('[Error] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  process.exit(1);
}

async function testConnection() {
  console.log('[Supabase] Connecting to:', supabaseUrl);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Check storage buckets
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.warn('[Supabase Storage Warning]:', bErr.message);
  } else {
    console.log('[Supabase Storage] Connected successfully! Found buckets:', buckets.map((b) => b.name));
  }

  // 2. Check if tables exist in PostgreSQL
  const tables = ['users', 'policies', 'rules', 'logs', 'violations'];
  for (const t of tables) {
    const { data, error, count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`[Supabase Table] ${t}: Not found or error (${error.message})`);
    } else {
      console.log(`[Supabase Table] ${t}: Exists! Count: ${count}`);
    }
  }
}

testConnection().catch((err) => {
  console.error('[Supabase Error]', err);
});
