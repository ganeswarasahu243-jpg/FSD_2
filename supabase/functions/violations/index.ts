/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { handleCors, errorResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseClient.ts';
import { handleGetViolations } from '../api/domains/violations.ts';

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const method = req.method.toUpperCase();
  const adminClient = getSupabaseAdmin();

  if (method === 'GET') return await handleGetViolations(req, adminClient);

  return errorResponse('Method not allowed.', 405);
});
