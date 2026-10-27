/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { handleCors, errorResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseClient.ts';
import {
  handleRegister,
  handleLogin,
  handleGetMe,
  handleUpdateProfile,
} from '../api/domains/auth.ts';

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const url = new URL(req.url);
  let pathname = url.pathname;
  if (pathname.includes('/auth/')) {
    pathname = pathname.slice(pathname.indexOf('/auth/') + 5);
  }
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  const method = req.method.toUpperCase();
  const adminClient = getSupabaseAdmin();

  if (clean === 'register' && method === 'POST') return await handleRegister(req, adminClient);
  if (clean === 'login' && method === 'POST') return await handleLogin(req, adminClient);
  if (clean === 'me' && method === 'GET') return await handleGetMe(req, adminClient);
  if (clean === 'profile' && method === 'PUT') return await handleUpdateProfile(req, adminClient);

  return errorResponse(`Auth route ${url.pathname} not found.`, 404);
});
