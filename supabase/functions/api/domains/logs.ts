import type { SupabaseClient } from '@supabase/supabase-js';
import { optionalAuthenticateRequest } from '../../_shared/auth.ts';
import { jsonResponse, errorResponse } from '../../_shared/cors.ts';
import { createViolationsForLog } from './monitoring.ts';

export async function handleGetLogs(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const { data: logs, error } = await adminClient
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return errorResponse(error.message, 500);
    }

    const formatted = (logs || []).map((l) => ({
      ...l,
      id: l.sqlite_id || l.id,
    }));

    return jsonResponse(formatted, 200);
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

export async function handleCreateLog(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const user = await optionalAuthenticateRequest(req, adminClient);
    const body = await req.json().catch(() => ({}));
    const action = (body.action || '').trim();

    if (!action) {
      return errorResponse('Action is required.', 400);
    }

    const { data: log, error: logErr } = await adminClient
      .from('logs')
      .insert({
        action,
        user_id: user ? user.id : null,
        username: user ? user.username : 'Unknown',
      })
      .select('id, sqlite_id, user_id, username, action, created_at')
      .single();

    if (logErr || !log) {
      return errorResponse(logErr?.message || 'Failed to create log.', 500);
    }

    await createViolationsForLog(log, adminClient);

    return jsonResponse(
      {
        ...log,
        id: log.sqlite_id || log.id,
      },
      201
    );
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}
