import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../../_shared/auth.ts';
import { jsonResponse, errorResponse } from '../../_shared/cors.ts';
import {
  severityFromText,
  buildViolationMessage,
  ruleMatchesAction,
  serializeViolation,
  type SerializedViolation,
} from '../../_shared/ruleEngine.ts';

export async function createViolationsForLog(
  log: { id: number | string; action: string; username?: string },
  adminClient: SupabaseClient
): Promise<Array<{ id: number | string; log_id: number | string; message: string; created_at?: string }>> {
  const created: Array<{ id: number | string; log_id: number | string; message: string; created_at?: string }> = [];

  const { data: rules } = await adminClient.from('rules').select('*');

  if (rules) {
    for (const rule of rules) {
      if (ruleMatchesAction(rule, log.action)) {
        const message = buildViolationMessage(rule, log.action);
        const { data: v, error: vErr } = await adminClient
          .from('violations')
          .insert({
            log_id: log.id,
            message,
          })
          .select('id, sqlite_id, log_id, message, created_at')
          .single();

        if (vErr) console.warn('[Monitoring] Violation insert notice:', vErr.message);
        if (v) created.push(v);
      }
    }
  }

  if (created.length === 0) {
    const genericSeverity = severityFromText(log.action);
    if (['Critical', 'High'].includes(genericSeverity)) {
      const { data: v, error: vErr } = await adminClient
        .from('violations')
        .insert({
          log_id: log.id,
          message: `${genericSeverity} risk activity detected: ${log.action}`,
        })
        .select('id, sqlite_id, log_id, message, created_at')
        .single();

      if (vErr) console.warn('[Monitoring] Generic violation insert notice:', vErr.message);
      if (v) created.push(v);
    }
  }

  return created;
}

export async function handleGetDashboard(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    const [
      { count: totalPolicies },
      { count: totalRules },
      { count: totalLogs },
      { count: totalViolations },
      { data: latestPolicies },
    ] = await Promise.all([
      adminClient.from('policies').select('*', { count: 'exact', head: true }),
      adminClient.from('rules').select('*', { count: 'exact', head: true }),
      adminClient.from('logs').select('*', { count: 'exact', head: true }),
      adminClient.from('violations').select('*', { count: 'exact', head: true }),
      adminClient
        .from('policies')
        .select('title, source_name, created_at')
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

    return jsonResponse({
      total_policies: totalPolicies || 0,
      total_rules: totalRules || 0,
      total_logs: totalLogs || 0,
      total_violations: totalViolations || 0,
      latest_policies: (latestPolicies || []).map((p) => ({
        title: p.title,
        source_name: p.source_name,
      })),
    });
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

export async function handleGetSiteData(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    const [
      { count: totalPolicies },
      { count: totalRules },
      { count: totalLogs },
      { count: totalViolations },
      { data: recentPolicies },
      { data: recentRules },
      { data: recentViolationsRaw },
    ] = await Promise.all([
      adminClient.from('policies').select('*', { count: 'exact', head: true }),
      adminClient.from('rules').select('*', { count: 'exact', head: true }),
      adminClient.from('logs').select('*', { count: 'exact', head: true }),
      adminClient.from('violations').select('*', { count: 'exact', head: true }),
      adminClient
        .from('policies')
        .select('id, sqlite_id, title, source_name, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      adminClient
        .from('rules')
        .select('id, sqlite_id, description, condition, action')
        .order('id', { ascending: false })
        .limit(4),
      adminClient
        .from('violations')
        .select(`
          id,
          sqlite_id,
          message,
          created_at,
          log_id,
          logs:log_id (
            id,
            sqlite_id,
            action,
            username
          )
        `)
        .order('id', { ascending: false })
        .limit(8),
    ]);

    const pCount = totalPolicies || 0;
    const rCount = totalRules || 0;
    const lCount = totalLogs || 0;
    const vCount = totalViolations || 0;

    const recentViolations: SerializedViolation[] = (recentViolationsRaw || []).map((v: Record<string, unknown>) => {
      const log = (v.logs as Record<string, unknown>) || null;
      return serializeViolation(
        {
          id: (v.sqlite_id as number) || (v.id as number | string),
          sqlite_id: v.sqlite_id as number | null,
          message: v.message as string,
          created_at: v.created_at as string,
        },
        log
          ? {
              action: log.action as string,
              username: log.username as string,
            }
          : null
      );
    });

    const frameworks = [
      {
        name: 'GDPR 2016/679',
        region: 'European Union',
        coverage: Math.min(100, 70 + pCount * 3),
      },
      {
        name: 'SOC 2 Type II',
        region: 'United States',
        coverage: Math.min(100, 76 + rCount * 2),
      },
      {
        name: 'HIPAA',
        region: 'Healthcare',
        coverage: Math.min(100, 55 + lCount * 4),
      },
    ];

    let monitoringFeed = (recentRules || []).map((item) => ({
      source: 'Policy Engine',
      title: item.description || 'Generated rule',
      description: item.action || item.condition || 'No details provided.',
    }));

    if (monitoringFeed.length === 0) {
      monitoringFeed = [
        {
          source: 'System',
          title: 'Awaiting monitoring data',
          description: 'Create policies or logs to generate live feed items.',
        },
      ];
    }

    const auditItems = frameworks.map((framework) => ({
      title: framework.name,
      status: framework.coverage < 70 ? 'At Risk' : 'Ready',
      progress: framework.coverage,
    }));

    let workflowItems = (recentRules || []).slice(0, 4).map((item, index) => ({
      title: item.description || `Workflow step ${index + 1}`,
      status: index === 0 ? 'Active' : 'Queued',
    }));

    if (workflowItems.length === 0) {
      workflowItems = [{ title: 'No workflow mappings yet', status: 'Pending' }];
    }

    const settings = {
      connected_modules: 3 + (rCount > 0 ? 1 : 0) + (lCount > 0 ? 1 : 0) + (pCount > 0 ? 1 : 0),
      sync_health: Math.min(100, 84 + pCount + lCount),
      recommended_action: 'Review access roles and save new policy interpretations under authenticated users.',
    };

    let alertItems = recentViolations.slice(0, 6).map((violation) => ({
      id: violation.id,
      title: violation.message || 'Policy violation detected',
      severity: violation.severity || 'Low',
      owner: violation.owner || 'Policy engine',
      status: violation.status || 'Observed',
      employee: violation.employee || 'Unknown',
      activity: violation.activity || '',
    }));

    if (alertItems.length === 0) {
      alertItems = [
        {
          title: 'No active alerts',
          severity: 'Healthy',
          owner: 'System',
          status: 'Monitoring',
          employee: 'N/A',
          activity: '',
        },
      ];
    }

    const criticalCount = recentViolations.filter((item) => item.severity === 'Critical').length;
    const highCount = recentViolations.filter((item) => item.severity === 'High').length;

    const alertSummary = {
      open_alerts: vCount,
      critical: criticalCount,
      high: highCount,
      needs_review: Math.max(0, lCount - vCount),
    };

    return jsonResponse({
      generated_at: new Date().toISOString(),
      detail: '',
      totals: {
        policies: pCount,
        rules: rCount,
        logs: lCount,
        violations: vCount,
      },
      recent_policies: (recentPolicies || []).map((p) => ({ ...p, id: p.sqlite_id || p.id })),
      recent_rules: (recentRules || []).map((r) => ({ ...r, id: r.sqlite_id || r.id })),
      recent_violations: recentViolations,
      frameworks,
      monitoring_feed: monitoringFeed,
      audit_items: auditItems,
      workflow_items: workflowItems,
      settings,
      alert_summary: alertSummary,
      alert_items: alertItems,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

export async function handleRecordActivityDemo(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const { user: authUser, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !authUser) return authErr!;

    if (!['compliance_officer', 'admin'].includes(authUser.role)) {
      return errorResponse('Forbidden: Compliance officer or administrator role required to run activity simulations.', 403);
    }

    const body = await req.json().catch(() => ({}));
    const employee = (body.employee || 'demo.employee').trim();
    const action = (body.action || '').trim();

    if (!action) {
      return errorResponse('Activity text is required.', 400);
    }

    // Find or create employee user
    let { data: user } = await adminClient
      .from('users')
      .select('id, sqlite_id, username')
      .ilike('username', employee)
      .maybeSingle();

    if (!user) {
      const { data: newUser, error: createErr } = await adminClient
        .from('users')
        .insert({
          username: employee,
          role: 'employee',
          email: '',
        })
        .select('id, sqlite_id, username')
        .single();

      if (createErr || !newUser) {
        return errorResponse(createErr?.message || 'Failed to initialize employee user.', 500);
      }
      user = newUser;
    }

    // Create activity log
    const { data: log, error: logErr } = await adminClient
      .from('logs')
      .insert({
        user_id: user.id,
        username: user.username,
        action,
      })
      .select('id, sqlite_id, user_id, username, action, created_at')
      .single();

    if (logErr || !log) {
      return errorResponse(logErr?.message || 'Failed to record activity log.', 500);
    }

    const createdViolations = await createViolationsForLog(log, adminClient);

    const serializedViolations = createdViolations.map((v) =>
      serializeViolation(
        {
          id: (v as Record<string, unknown>).sqlite_id ? (v as Record<string, unknown>).sqlite_id as number : v.id,
          message: v.message,
          created_at: v.created_at,
        },
        { action: log.action, username: user.username }
      )
    );

    return jsonResponse(
      {
        log_id: log.sqlite_id || log.id,
        employee: user.username,
        activity: log.action,
        violations: serializedViolations,
        message: 'Activity recorded.',
      },
      201
    );
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

export async function handleResolveAlert(
  req: Request,
  violationId: string,
  adminClient: SupabaseClient
): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    if (!['compliance_officer', 'admin'].includes(user.role)) {
      return errorResponse('Forbidden: Only compliance officers and administrators can resolve alerts.', 403);
    }

    const isNum = /^\d+$/.test(violationId);
    let query = adminClient.from('violations').select('id, sqlite_id, log_id');

    if (isNum) {
      query = query.or(`id.eq.${violationId},sqlite_id.eq.${violationId}`);
    } else {
      query = query.eq('id', violationId);
    }

    const { data: violation, error: vErr } = await query.maybeSingle();

    if (vErr || !violation) {
      return errorResponse('Alert not found.', 404);
    }

    const logId = violation.log_id;

    // Delete violation
    await adminClient.from('violations').delete().eq('id', violation.id);

    // If no more violations for this log, delete the log too
    if (logId) {
      const { count: remainingCount } = await adminClient
        .from('violations')
        .select('*', { count: 'exact', head: true })
        .eq('log_id', logId);

      if (remainingCount === 0) {
        await adminClient.from('logs').delete().eq('id', logId);
      }
    }

    return jsonResponse({
      detail: 'Alert marked as solved and removed from the database.',
      resolved_id: violationId,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

export async function handleKeepAlertPending(
  req: Request,
  violationId: string,
  adminClient: SupabaseClient
): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    if (!['compliance_officer', 'admin'].includes(user.role)) {
      return errorResponse('Forbidden: Only compliance officers and administrators can update alert status.', 403);
    }

    const isNum = /^\d+$/.test(violationId);
    let query = adminClient.from('violations').select(`
      id,
      sqlite_id,
      message,
      created_at,
      log_id,
      logs:log_id (
        id,
        sqlite_id,
        action,
        username
      )
    `);

    if (isNum) {
      query = query.or(`id.eq.${violationId},sqlite_id.eq.${violationId}`);
    } else {
      query = query.eq('id', violationId);
    }

    const { data: violation, error: vErr } = await query.maybeSingle();

    if (vErr || !violation) {
      return errorResponse('Alert not found.', 404);
    }

    const log = (violation.logs as Record<string, unknown>) || null;
    const payload = serializeViolation(
      {
        id: (violation.sqlite_id as number) || (violation.id as number | string),
        sqlite_id: violation.sqlite_id as number | null,
        message: violation.message as string,
        created_at: violation.created_at as string,
      },
      log
        ? {
            action: log.action as string,
            username: log.username as string,
          }
        : null
    );

    payload.status = 'Still Pending';

    return jsonResponse({
      detail: 'Alert is still pending and remains in the monitoring queue.',
      alert: payload,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}
