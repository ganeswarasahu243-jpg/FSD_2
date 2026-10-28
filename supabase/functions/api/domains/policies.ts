import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../../_shared/auth.ts';
import { jsonResponse, errorResponse } from '../../_shared/cors.ts';
import { aiRules, buildInterpreterResponse } from '../../_shared/ruleEngine.ts';
import { extractTextFromBytes } from '../../_shared/documentParser.ts';

export async function handleInterpretPolicy(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    if (!['compliance_officer', 'admin'].includes(user.role)) {
      return errorResponse('Forbidden: Only compliance officers and administrators can interpret policy documents.', 403);
    }

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
      const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB safe ceiling for Edge isolate
      if (uploadedFile.size > MAX_UPLOAD_SIZE) {
        return errorResponse('File size exceeds the 10MB limit.', 400);
      }
      const safeFilename = uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = safeFilename.slice(safeFilename.lastIndexOf('.')).toLowerCase();
      if (!['.pdf', '.txt', '.docx'].includes(ext)) {
        return errorResponse('Only PDF, TXT, and DOCX files are supported right now.', 400);
      }
      const bytes = new Uint8Array(await uploadedFile.arrayBuffer());
      extractedText = (await extractTextFromBytes(bytes, safeFilename)).trim();
      sourceName = safeFilename;
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

    if (!['compliance_officer', 'admin'].includes(user.role)) {
      return errorResponse('Forbidden: Only compliance officers and administrators can save policies.', 403);
    }

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
      const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
      if (uploadedFile.size > MAX_UPLOAD_SIZE) {
        return errorResponse('File size exceeds the 10MB limit.', 400);
      }
      const safeFilename = uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = safeFilename.slice(safeFilename.lastIndexOf('.')).toLowerCase();
      if (!['.pdf', '.txt', '.docx'].includes(ext)) {
        return errorResponse('Only PDF, TXT, and DOCX files are supported.', 400);
      }

      sourceName = safeFilename;
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const storageKey = `policies/${uniqueSuffix}-${safeFilename}`;
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
        policyText = (await extractTextFromBytes(bytes, safeFilename)).trim();
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
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

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
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

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

/**
 * Generates an authenticated, short-lived signed URL for downloading policy documents.
 * GET /api/policies/:id/download
 */
export async function handleDownloadPolicyDocument(
  req: Request,
  idParam: string,
  adminClient: SupabaseClient
): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    const isNum = /^\d+$/.test(idParam);
    let query = adminClient.from('policies').select('id, sqlite_id, title, document');

    if (isNum) {
      query = query.or(`id.eq.${idParam},sqlite_id.eq.${idParam}`);
    } else {
      query = query.eq('id', idParam);
    }

    const { data: policy, error: policyErr } = await query.maybeSingle();

    if (policyErr || !policy) {
      return errorResponse('Policy not found.', 404);
    }

    if (!policy.document) {
      return errorResponse('No document file attached to this policy.', 404);
    }

    // Path traversal and storage boundary validation
    const cleanDocPath = policy.document.replace(/^\/+/, '');
    if (!cleanDocPath.startsWith('policies/') || cleanDocPath.includes('..')) {
      return errorResponse('Invalid policy document path.', 400);
    }

    // Generate a secure, time-limited signed download URL (valid for 1 hour / 3600 seconds)
    const { data: signedData, error: signErr } = await adminClient.storage
      .from('policies')
      .createSignedUrl(cleanDocPath, 3600);

    if (signErr || !signedData?.signedUrl) {
      console.error('Signed URL generation error:', signErr);
      return errorResponse('Failed to generate document download URL.', 500);
    }

    return jsonResponse({
      id: policy.sqlite_id || policy.id,
      title: policy.title,
      document_path: policy.document,
      download_url: signedData.signedUrl,
      expires_in: 3600,
    }, 200);
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

/**
 * Update policy title and/or content
 * PUT /api/policies/:id
 */
export async function handleUpdatePolicy(
  req: Request,
  idParam: string,
  adminClient: SupabaseClient
): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    if (!['compliance_officer', 'admin'].includes(user.role)) {
      return errorResponse('Forbidden: Only compliance officers and administrators can update policies.', 403);
    }

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

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const cleanTitle = String(body.title).trim();
      if (!cleanTitle) {
        return errorResponse('Policy title cannot be empty.', 400);
      }
      updates.title = cleanTitle;
    }

    let rulesCount = 0;
    if (body.content_text !== undefined) {
      const cleanText = String(body.content_text).trim();
      updates.content_text = cleanText;

      // Re-extract rules if text is updated
      await adminClient.from('rules').delete().eq('policy_id', policy.id);
      if (cleanText) {
        const rules = await aiRules(cleanText);
        const ruleInserts = rules.map((r) => ({
          policy_id: policy.id,
          description: r.description || '',
          condition: r.condition || '',
          action: r.action || '',
        }));
        if (ruleInserts.length > 0) {
          const { data: insertedRules } = await adminClient.from('rules').insert(ruleInserts).select('id');
          rulesCount = insertedRules?.length || 0;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      const { data: updatedPolicy, error: updateErr } = await adminClient
        .from('policies')
        .update(updates)
        .eq('id', policy.id)
        .select('*')
        .single();

      if (updateErr || !updatedPolicy) {
        return errorResponse(updateErr?.message || 'Failed to update policy.', 500);
      }

      return jsonResponse({
        id: updatedPolicy.sqlite_id || updatedPolicy.id,
        title: updatedPolicy.title,
        source_name: updatedPolicy.source_name,
        rules_count: rulesCount,
        message: 'Policy updated successfully.',
      }, 200);
    }

    return jsonResponse({
      id: policy.sqlite_id || policy.id,
      title: policy.title,
      message: 'No changes provided.',
    }, 200);
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

/**
 * Delete a policy and its rules
 * DELETE /api/policies/:id
 */
export async function handleDeletePolicy(
  req: Request,
  idParam: string,
  adminClient: SupabaseClient
): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    if (!['compliance_officer', 'admin'].includes(user.role)) {
      return errorResponse('Forbidden: Only compliance officers and administrators can delete policies.', 403);
    }

    const isNum = /^\d+$/.test(idParam);
    let query = adminClient.from('policies').select('id, sqlite_id, title, document');
    if (isNum) {
      query = query.or(`id.eq.${idParam},sqlite_id.eq.${idParam}`);
    } else {
      query = query.eq('id', idParam);
    }

    const { data: policy, error: policyErr } = await query.maybeSingle();
    if (policyErr || !policy) {
      return errorResponse('Policy not found.', 404);
    }

    // Clean up document in storage if present
    if (policy.document) {
      try {
        const cleanDocPath = policy.document.replace(/^\/+/, '');
        await adminClient.storage.from('policies').remove([cleanDocPath]);
      } catch (storageErr) {
        console.warn('Notice: Failed to remove storage document during policy deletion:', storageErr);
      }
    }

    // Cascade delete rules
    await adminClient.from('rules').delete().eq('policy_id', policy.id);

    // Delete policy record
    const { error: delErr } = await adminClient.from('policies').delete().eq('id', policy.id);
    if (delErr) {
      return errorResponse(delErr.message || 'Failed to delete policy.', 500);
    }

    return jsonResponse({
      detail: `Policy "${policy.title}" deleted successfully.`,
      deleted_id: idParam,
    }, 200);
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}
