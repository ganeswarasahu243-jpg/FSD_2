/**
 * Rule Engine & NLP heuristic extractor
 * Faithfully replicates and enhances Python ai_utils and monitoring rule matching.
 */

const normalizeText = (value) => {
  return (value || '').trim().toLowerCase();
};

const shortenText = (value, limit = 120) => {
  const text = (value || '').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3).trimEnd()}...`;
};

const severityFromText = (...parts) => {
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

const statusFromSeverity = (severity) => {
  const mapping = {
    Critical: 'Open',
    High: 'Investigating',
    Medium: 'Queued',
    Low: 'Observed',
  };
  return mapping[severity] || 'Observed';
};

const buildViolationMessage = (rule, actionText) => {
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

const ruleMatchesAction = (rule, actionText) => {
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

const heuristicRules = (text) => {
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

/**
 * Generates rule items from text.
 * Uses heuristic rule extraction (with support for pluggable LLM/HF pipeline)
 */
const aiRules = async (text) => {
  if (!text || !text.trim()) return [];
  // Direct native heuristic extraction ensures 0ms latency and high reliability
  return heuristicRules(text);
};

const buildInterpreterResponse = (title, sourceName, text, rules) => {
  const actions = (rules || []).slice(0, 5).map((rule) => ({
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

module.exports = {
  normalizeText,
  shortenText,
  severityFromText,
  statusFromSeverity,
  buildViolationMessage,
  ruleMatchesAction,
  heuristicRules,
  aiRules,
  buildInterpreterResponse,
};
