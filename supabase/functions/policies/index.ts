/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { handleCors, errorResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseClient.ts';
import {
  handleInterpretPolicy,
  handleSavePolicy,
  handleGetPolicies,
  handleGetPolicyById,
} from '../api/domains/policies.ts';

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const url = new URL(req.url);
  let pathname = url.pathname;
  if (pathname.includes('/policies/')) {
    pathname = pathname.slice(pathname.indexOf('/policies/') + 9);
  }
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  const method = req.method.toUpperCase();
  const adminClient = getSupabaseAdmin();

  if ((clean === 'interpret' || clean === 'policy-interpreter' || clean === '') && method === 'POST') {
    return await handleInterpretPolicy(req, adminClient);
  }
  if (clean === 'save' && method === 'POST') {
    return await handleSavePolicy(req, adminClient);
  }
  if (clean === '' && method === 'GET') {
    return await handleGetPolicies(req, adminClient);
  }
  if (clean && method === 'GET') {
    return await handleGetPolicyById(req, clean, adminClient);
  }

  return errorResponse(`Policies route ${url.pathname} not found.`, 404);
});
