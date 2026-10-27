const path = require('path');
const Policy = require('../models/Policy');
const Rule = require('../models/Rule');
const { extractTextFromFile } = require('../services/documentParser');
const { aiRules, buildInterpreterResponse } = require('../services/ruleEngine');

/**
 * Interpret a policy document or text input without saving
 * POST /api/policy-interpreter/
 */
const interpretPolicy = async (req, res, next) => {
  try {
    const title = (req.body.title || '').trim();
    const policyText = (req.body.policy_text || '').trim();
    const uploadedFile = req.file;

    if (!policyText && !uploadedFile) {
      return res.status(400).json({ detail: 'Provide either policy_text or policy_file.' });
    }

    if (policyText && uploadedFile) {
      return res.status(400).json({ detail: 'Submit either text or file, not both.' });
    }

    let sourceName = 'Direct text input';
    let extractedText = policyText;

    if (uploadedFile) {
      const ext = path.extname(uploadedFile.originalname).toLowerCase();
      if (!['.pdf', '.txt', '.docx'].includes(ext)) {
        return res.status(400).json({ detail: 'Only PDF, TXT, and DOCX files are supported right now.' });
      }
      extractedText = (await extractTextFromFile(uploadedFile.path)).trim();
      sourceName = uploadedFile.originalname;
    }

    const rules = await aiRules(extractedText);
    const payload = buildInterpreterResponse(title, sourceName, extractedText, rules);

    return res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

/**
 * Save an interpreted policy and create associated rules
 * POST /api/policies/save/
 */
const savePolicy = async (req, res, next) => {
  try {
    const title = (req.body.title || 'Untitled policy').trim();
    let policyText = (req.body.policy_text || '').trim();
    const uploadedFile = req.file;
    let sourceName = 'Direct text input';
    let documentPath = null;

    if (!policyText && !uploadedFile) {
      return res.status(400).json({ detail: 'Provide either policy_text or policy_file to save.' });
    }

    if (uploadedFile) {
      sourceName = uploadedFile.originalname;
      documentPath = `policies/${uploadedFile.filename}`;
      if (!policyText) {
        policyText = (await extractTextFromFile(uploadedFile.path)).trim();
      }
    }

    const policy = await Policy.create({
      title,
      document: documentPath,
      source_name: sourceName,
      content_text: policyText,
      uploaded_by: req.user ? req.user._id : null,
      uploaded_by_username: req.user ? req.user.username : 'Unknown',
    });

    const rules = await aiRules(policyText);
    const createdRules = [];

    for (const rule of rules) {
      const createdRule = await Rule.create({
        policy: policy._id,
        description: rule.description || '',
        condition: rule.condition || '',
        action: rule.action || '',
      });
      createdRules.push(createdRule);
    }

    return res.status(201).json({
      id: policy.sqliteId || policy._id,
      title: policy.title,
      source_name: policy.source_name,
      saved_by: req.user ? req.user.username : 'Unknown',
      rules_created: createdRules.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all policies
 * GET /api/policies/
 */
const getPolicies = async (req, res, next) => {
  try {
    const policies = await Policy.find().sort({ created_at: -1 });
    return res.status(200).json(policies);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single policy by ID with its rules
 * GET /api/policies/:id/
 */
const getPolicyById = async (req, res, next) => {
  try {
    const id = req.params.id;
    let policy = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      policy = await Policy.findById(id);
    } else {
      policy = await Policy.findOne({ sqliteId: parseInt(id, 10) });
    }

    if (!policy) {
      return res.status(404).json({ detail: 'Policy not found.' });
    }

    const rules = await Rule.find({ policy: policy._id });
    return res.status(200).json({ policy, rules });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  interpretPolicy,
  savePolicy,
  getPolicies,
  getPolicyById,
};
