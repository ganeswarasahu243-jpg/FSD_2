import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../../_shared/auth.ts';
import { jsonResponse, errorResponse } from '../../_shared/cors.ts';
import { aiRules, buildInterpreterResponse } from '../../_shared/ruleEngine.ts';
import { extractTextFromBytes } from '../../_shared/documentParser.ts';

export async function handleInterpretPolicy(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const contentType = req.headers.get('content-type') || '';
    let title = '';
    let policyText = '';
    let uploadedFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      title = (formData.get('title') as string || '').trim();
      policyText = (formData.get('policy_text') as string || '').trim();
      uploadedFile = formData.get('policy_file') as File | null;
    } else {
      const body = await req.json().catch(() => ({}));
      title = (body.title || '').trim();
      policyText = (body.policy_text || '').trim();
    }

    if (!policyText && !uploadedFile) {
      return errorResponse('Provide either policy_text or policy_file.', 400);
    }
    if (policyText && uploadedFile) {
      return errorResponse('Submit either text or file, not both.', 400);
    }

    let sourceName = 'Direct text input';
    let extractedText = policyText;

    if (uploadedFile) {
      if (uploadedFile.size > 20 * 1024 * 1024) {
        return errorResponse('File size exceeds the 20MB limit.', 400);
      }
      const ext = uploadedFile.name.slice(uploadedFile.name.lastIndexOf('.')).toLowerCase();
      if (!['.pdf', '.txt', '.docx'].includes(ext)) {
        return errorResponse('Only PDF, TXT, and DOCX files are supported right now.', 400);
      }
      const bytes = new Uint8Array(await uploadedFile.arrayBuffer());
      extractedText = (await extractTextFromBytes(bytes, uploadedFile.name)).trim();
      sourceName = uploadedFile.name;
    }

    const rules = await aiRules(extractedText);
    const payload = buildInterpreterResponse(title, sourceName, extractedText, rules);

    return jsonResponse(payload, 200);
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

export async function handleSavePolicy(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    const contentType = req.headers.get('content-type') || '';
    let title = 'Untitled policy';
    let policyText = '';
    let uploadedFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const formTitle = formData.get('title') as string | null;
      if (formTitle) title = formTitle.trim();
      policyText = (formData.get('policy_text') as string || '').trim();
      uploadedFile = formData.get('policy_file') as File | null;
    } else {
      const body = await req.json().catch(() => ({}));
      if (body.title) title = body.title.trim();
      policyText = (body.policy_text || '').trim();
    }

    if (!policyText && !uploadedFile) {
      return errorResponse('Provide either policy_text or policy_file to save.', 400);
    }

    let sourceName = 'Direct text input';
    let documentPath: string | null = null;

    if (uploadedFile) {
      if (uploadedFile.size > 20 * 1024 * 1024) {
        return errorResponse('File size exceeds the 20MB limit.', 400);
      }
      sourceName = uploadedFile.name;
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const storageKey = `policies/${uniqueSuffix}-${uploadedFile.name}`;
      const bytes = new Uint8Array(await uploadedFile.arrayBuffer());

      // Upload to Supabase Storage
      const { error: uploadError } = await adminClient.storage
        .from('policies')
        .upload(storageKey, bytes, {
          contentType: uploadedFile.type || 'application/octet-stream',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload notice (falling back to path record):', uploadError.message);
      }
      documentPath = storageKey;

      if (!policyText) {
        policyText = (await extractTextFromBytes(bytes, uploadedFile.name)).trim();
      }
    }

    // Insert policy into PostgreSQL
    const { data: policy, error: policyErr } = await adminClient
      .from('policies')
      .insert({
        title,
        document: documentPath,
        source_name: sourceName,
        content_text: policyText,
        uploaded_by: user.id,
        uploaded_by_username: user.username || 'Unknown',
      })
      .select('id, sqlite_id, title, source_name, uploaded_by_username')
      .single();

    if (policyErr || !policy) {
      console.error('Save policy error:', policyErr);
      return errorResponse(policyErr?.message || 'Failed to save policy.', 500);
    }

    // Extract rules and insert into PostgreSQL
    const rules = await aiRules(policyText);
    const ruleInserts = rules.map((r) => ({
      policy_id: policy.id,
      description: r.description || '',
      condition: r.condition || '',
      action: r.action || '',
    }));

    let rulesCreatedCount = 0;
    if (ruleInserts.length > 0) {
      const { data: insertedRules, error: rulesErr } = await adminClient
        .from('rules')
        .insert(ruleInserts)
        .select('id');

      if (!rulesErr && insertedRules) {
        rulesCreatedCount = insertedRules.length;
      }
    }

    return jsonResponse(
      {
        id: policy.sqlite_id || policy.id,
        title: policy.title,
        source_name: policy.source_name,
        saved_by: policy.uploaded_by_username || user.username || 'Unknown',
        rules_created: rulesCreatedCount,
      },
      201
    );
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

export async function handleGetPolicies(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const { data: policies, error } = await adminClient
      .from('policies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return errorResponse(error.message, 500);
    }

    const formatted = (policies || []).map((p) => ({
      ...p,
      id: p.sqlite_id || p.id,
    }));

    return jsonResponse(formatted, 200);
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

export async function handleGetPolicyById(
  req: Request,
  idParam: string,
  adminClient: SupabaseClient
): Promise<Response> {
  try {
    const isNum = /^\d+$/.test(idParam);
    let query = adminClient.from('policies').select('*');

    if (isNum) {
      query = query.or(`id.eq.${idParam},sqlite_id.eq.${idParam}`);
    } else {
      query = query.eq('id', idParam);
    }

    const { data: policy, error: policyErr } = await query.maybeSingle();

    if (policyErr || !policy) {
      return errorResponse('Policy not found.', 404);
    }

    const { data: rules } = await adminClient
      .from('rules')
      .select('*')
      .eq('policy_id', policy.id);

    const formattedPolicy = {
      ...policy,
      id: policy.sqlite_id || policy.id,
    };

    const formattedRules = (rules || []).map((r) => ({
      ...r,
      id: r.sqlite_id || r.id,
    }));

    return jsonResponse({ policy: formattedPolicy, rules: formattedRules }, 200);
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}
