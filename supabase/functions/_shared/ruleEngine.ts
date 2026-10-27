/**
 * Rule Engine & NLP heuristic extractor for Supabase Edge Functions.
 * TypeScript port preserving exact contracts, keyword lists, and heuristic algorithms.
 */

export interface RuleItem {
  id?: number | string;
  policy_id?: number | string;
  description: string;
  condition: string;
  action: string;
}

export interface InterpretedAction {
  title: string;
  description: string;
  impact: string;
  risk: string;
}

export interface InterpreterResponse {
  title: string;
  source: string;
  summary: string;
  confidence: string;
  projected_cost: string;
  cost_trend: string;
  complexity_label: string;
  complexity_score: number;
  actions: InterpretedAction[];
}

export interface SerializedViolation {
  id: string | number;
  message: string;
  title: string;
  severity: string;
  status: string;
  owner: string;
  employee: string;
  activity: string;
}

export const normalizeText = (value?: string | null): string => {
  return (value || '').trim().toLowerCase();
};

export const shortenText = (value?: string | null, limit = 120): string => {
  const text = (value || '').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3).trimEnd()}...`;
};

export const severityFromText = (...parts: (string | null | undefined)[]): string => {
  const text = parts.map((part) => normalizeText(part)).join(' ');
  const criticalTerms = ['confidential', 'external', 'breach', 'leak', 'finance', 'payroll', 'customer data'];
  const highTerms = ['download', 'export', 'usb', 'admin', 'delete', 'disable', 'share'];
  const mediumTerms = ['late', 'missing', 'public', 'warning', 'retry'];

  if (criticalTerms.some((term) => text.includes(term))) {
    return 'Critical';
  }
  if (highTerms.some((term) => text.includes(term))) {
    return 'High';
  }
  if (mediumTerms.some((term) => text.includes(term))) {
    return 'Medium';
  }
  return 'Low';
};

export const statusFromSeverity = (severity: string): string => {
  const mapping: Record<string, string> = {
    Critical: 'Open',
    High: 'Investigating',
    Medium: 'Queued',
    Low: 'Observed',
  };
  return mapping[severity] || 'Observed';
};

export const buildViolationMessage = (rule: { description?: string; condition?: string }, actionText?: string): string => {
  const description = (rule.description || 'Policy rule').trim();
  const condition = (rule.condition || '').trim();
  if (condition) {
    return `${description}: ${condition}`;
  }
  if (actionText) {
    return `${description}: ${actionText}`;
  }
  return description;
};

export const ruleMatchesAction = (
  rule: { condition?: string; description?: string; action?: string },
  actionText?: string
): boolean => {
  const action = normalizeText(actionText);
  const condition = normalizeText(rule.condition);
  const description = normalizeText(rule.description);
  const policyAction = normalizeText(rule.action);

  if (condition && action.includes(condition)) {
    return true;
  }

  const combined = [condition, description, policyAction].filter(Boolean).join(' ');
  const keywords = combined
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 4);

  return keywords.slice(0, 6).some((keyword) => action.includes(keyword));
};

export const heuristicRules = (text: string): RuleItem[] => {
  if (!text || !text.trim()) return [];

  // Split into sentences using punctuation boundaries
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 3);

  return sentences.map((sentence) => ({
    description: sentence.slice(0, 180),
    condition: 'When this policy requirement applies',
    action: 'Review the clause, assign an owner, and update the mapped business process.',
  }));
};

export const aiRules = async (text: string): Promise<RuleItem[]> => {
  if (!text || !text.trim()) return [];
  return heuristicRules(text);
};

export const buildInterpreterResponse = (
  title?: string,
  sourceName?: string,
  text?: string,
  rules?: RuleItem[]
): InterpreterResponse => {
  const actions: InterpretedAction[] = (rules || []).slice(0, 5).map((rule) => ({
    title: rule.description || 'Policy action',
    description: rule.condition || 'Condition not provided.',
    impact: 'Extracted',
    risk: rule.action || 'Follow up with policy owner.',
  }));

  const textLength = text ? text.length : 0;
  let complexityLabel = '';
  if (text) {
    complexityLabel = textLength < 500 ? 'Low' : textLength < 1200 ? 'Medium' : 'High';
  }

  return {
    title: title || 'Policy interpretation',
    source: sourceName || 'Direct text input',
    summary: text ? text.slice(0, 600) : '',
    confidence: `${actions.length} rule(s) extracted`,
    projected_cost: '',
    cost_trend: '',
    complexity_label: complexityLabel,
    complexity_score: text ? Math.min(100, Math.floor(textLength / 20)) : 0,
    actions,
  };
};

export const serializeViolation = (
  violation: { id: string | number; sqlite_id?: number | null; message: string; created_at?: string | Date },
  log?: { action?: string; username?: string } | null
): SerializedViolation => {
  const actionText = log?.action || '';
  const employeeUsername = log?.username || 'Unknown';
  const severity = severityFromText(violation.message, actionText);
  const status = statusFromSeverity(severity);
  const titleSource = violation.message || actionText || 'Policy violation detected';

  return {
    id: violation.sqlite_id || violation.id,
    message: violation.message,
    title: shortenText(titleSource, 88),
    severity,
    status,
    owner: 'Policy engine',
    employee: employeeUsername,
    activity: actionText,
  };
};
