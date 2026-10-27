/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseClient.ts';

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const url = new URL(req.url);
  const clean = url.pathname.replace(/^\/+|\/+$/g, '');

  if (clean === 'health/ready') {
    try {
      const adminClient = getSupabaseAdmin();
      const { error } = await adminClient.from('users').select('id', { head: true, count: 'exact' }).limit(1);
      if (error) {
        return jsonResponse({ status: 'not_ready', database: 'disconnected', error: error.message }, 503);
      }
      return jsonResponse({ status: 'ready', database: 'connected' }, 200);
    } catch (e: unknown) {
      const err = e as Error;
      return jsonResponse({ status: 'not_ready', database: 'error', error: err.message }, 503);
    }
  }

  return jsonResponse({
    status: 'ok',
    service: 'sentinel-core',
    runtime: 'supabase-edge-functions',
    timestamp: new Date().toISOString(),
  });
});
