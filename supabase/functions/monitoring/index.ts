/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { handleCors, errorResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseClient.ts';
import {
  handleGetDashboard,
  handleGetSiteData,
  handleRecordActivityDemo,
  handleResolveAlert,
  handleKeepAlertPending,
} from '../api/domains/monitoring.ts';

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const url = new URL(req.url);
  let pathname = url.pathname;
  if (pathname.includes('/monitoring/')) {
    pathname = pathname.slice(pathname.indexOf('/monitoring/') + 11);
  }
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  const method = req.method.toUpperCase();
  const adminClient = getSupabaseAdmin();

  if (clean === 'dashboard' && method === 'GET') return await handleGetDashboard(req, adminClient);
  if (clean === 'site-data' && method === 'GET') return await handleGetSiteData(req, adminClient);
  if (clean === 'activity-demo' && method === 'POST') return await handleRecordActivityDemo(req, adminClient);

  const resolveMatch = clean.match(/^alerts\/([^/]+)\/resolve$/);
  if (resolveMatch && method === 'POST') return await handleResolveAlert(req, resolveMatch[1], adminClient);

  const pendingMatch = clean.match(/^alerts\/([^/]+)\/pending$/);
  if (pendingMatch && method === 'POST') return await handleKeepAlertPending(req, pendingMatch[1], adminClient);

  return errorResponse(`Monitoring route ${url.pathname} not found.`, 404);
});
