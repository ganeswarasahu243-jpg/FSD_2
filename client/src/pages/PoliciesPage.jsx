import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  FileCheck2,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  Check,
  ChevronRight,
  ShieldCheck,
  Download,
  Trash2,
  Edit3,
  Search,
  Eye,
  RotateCw,
  FolderOpen,
} from 'lucide-react';
import { apiRequest, isComplianceOrAdmin } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Input, Textarea } from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import EmptyState from '../components/ui/EmptyState';
import { TableRowSkeleton } from '../components/ui/Skeleton';

const SAMPLE_POLICIES = [
  {
    title: 'Customer Data Encryption & Privacy Policy',
    text: 'All employees must encrypt sensitive customer personal information before transmission over public networks. Access keys and tokens must be rotated every 90 days. Backups must occur daily to secure off-site vaults. Unauthorized access or credential sharing will result in immediate suspension.',
  },
  {
    title: 'Acceptable Cloud Storage & USB Device Policy',
    text: 'Company confidential files and employee payroll records shall never be transferred to personal USB flash drives or unapproved third-party cloud storage. All external communications containing client financial data require multi-factor authorization and audit trail logging.',
  },
];

export default function PoliciesPage() {
  const [activeTab, setActiveTab] = useState(isComplianceOrAdmin() ? 'ingest' : 'repository'); // 'ingest' | 'repository'

  // --- Ingestion State ---
  const [inputMode, setInputMode] = useState('text'); // 'text' | 'file'
  const [title, setTitle] = useState('');
  const [policyText, setPolicyText] = useState('');
  const [policyFile, setPolicyFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type, message }
  const [result, setResult] = useState(null);

  // --- Repository State ---
  const [policies, setPolicies] = useState([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [policySearch, setPolicySearch] = useState('');
  const [selectedPolicyDetail, setSelectedPolicyDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit policy state
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');
  const [updatingPolicy, setUpdatingPolicy] = useState(false);

  // Delete policy state
  const [deletingId, setDeletingId] = useState(null);

  const loadPolicies = async () => {
    try {
      setLoadingPolicies(true);
      const data = await apiRequest('/api/policies/');
      setPolicies(Array.isArray(data) ? data : []);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load policy repository.' });
    } finally {
      setLoadingPolicies(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, [activeTab]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setPolicyFile(file);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPolicyFile(file);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const loadSample = (sample) => {
    setInputMode('text');
    setTitle(sample.title);
    setPolicyText(sample.text);
    setPolicyFile(null);
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (inputMode === 'text' && !policyText.trim()) {
      setFeedback({ type: 'warning', message: 'Policy text is required.' });
      return;
    }
    if (inputMode === 'file' && !policyFile) {
      setFeedback({ type: 'warning', message: 'Policy file (.pdf, .docx, or .txt) is required.' });
      return;
    }

    setAnalyzing(true);
    setFeedback(null);

    try {
      let data;
      if (inputMode === 'text') {
        data = await apiRequest('/api/policy-interpreter/', {
          method: 'POST',
          body: {
            title: title.trim(),
            policy_text: policyText.trim(),
          },
        });
      } else {
        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('policy_file', policyFile);
        data = await apiRequest('/api/policy-interpreter/', {
          method: 'POST',
          body: formData,
        });
      }

      setResult(data);
      setFeedback({
        type: 'success',
        message: `Analysis complete! Extracted ${data.actions?.length || 0} regulatory action rules.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Policy analysis failed.' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSavePolicy = async () => {
    if (inputMode === 'text' && !policyText.trim()) {
      setFeedback({ type: 'warning', message: 'Policy text is required to save.' });
      return;
    }
    if (inputMode === 'file' && !policyFile) {
      setFeedback({ type: 'warning', message: 'Policy file is required to save.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      let data;
      if (inputMode === 'text') {
        data = await apiRequest('/api/policies/save/', {
          method: 'POST',
          body: {
            title: title.trim() || 'Untitled Policy',
            policy_text: policyText.trim(),
          },
        });
      } else {
        const formData = new FormData();
        formData.append('title', title.trim() || 'Untitled Policy');
        formData.append('policy_file', policyFile);
        data = await apiRequest('/api/policies/save/', {
          method: 'POST',
          body: formData,
        });
      }

      setFeedback({
        type: 'success',
        message: `Policy "${data.title}" saved to Supabase PostgreSQL successfully with ${data.rules_created} persistent rule(s).`,
      });
      // Refresh repository cache if already visited
      loadPolicies();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save policy.' });
    } finally {
      setSaving(false);
    }
  };

  // --- View Details & Rules Handler ---
  const handleViewPolicy = async (policyId) => {
    try {
      setLoadingDetail(true);
      const data = await apiRequest(`/api/policies/${policyId}/`);
      setSelectedPolicyDetail(data);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load policy rules.' });
    } finally {
      setLoadingDetail(false);
    }
  };

  // --- Download Signed Document Handler ---
  const handleDownloadDocument = async (policyId, title) => {
    try {
      setFeedback({ type: 'info', message: `Generating secure download token for "${title}"...` });
      const data = await apiRequest(`/api/policies/${policyId}/download/`);
      if (data.download_url) {
        window.open(data.download_url, '_blank', 'noopener,noreferrer');
        setFeedback({ type: 'success', message: `Secure signed download URL generated for "${title}".` });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to download policy document.' });
    }
  };

  // --- Edit Policy Handler ---
  const handleStartEdit = (policy) => {
    setEditingPolicy(policy);
    setEditTitle(policy.title || '');
    setEditText(policy.content_text || '');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingPolicy) return;
    if (!editTitle.trim()) {
      setFeedback({ type: 'warning', message: 'Policy title is required.' });
      return;
    }

    setUpdatingPolicy(true);
    setFeedback(null);

    try {
      const res = await apiRequest(`/api/policies/${editingPolicy.id}/`, {
        method: 'PUT',
        body: {
          title: editTitle.trim(),
          content_text: editText.trim(),
        },
      });

      setFeedback({
        type: 'success',
        message: res.message || `Policy "${editTitle}" updated successfully.`,
      });

      setEditingPolicy(null);
      await loadPolicies();
      if (selectedPolicyDetail && selectedPolicyDetail.policy?.id === editingPolicy.id) {
        await handleViewPolicy(editingPolicy.id);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update policy.' });
    } finally {
      setUpdatingPolicy(false);
    }
  };

  // --- Delete Policy Handler ---
  const handleDeletePolicy = async (policyId, policyTitle) => {
    if (!window.confirm(`Are you sure you want to delete policy "${policyTitle}" and its associated rules? This cannot be undone.`)) {
      return;
    }

    setDeletingId(policyId);
    setFeedback(null);

    try {
      const res = await apiRequest(`/api/policies/${policyId}/`, {
        method: 'DELETE',
      });

      setFeedback({
        type: 'success',
        message: res.detail || `Policy "${policyTitle}" deleted successfully.`,
      });

      if (selectedPolicyDetail && selectedPolicyDetail.policy?.id === policyId) {
        setSelectedPolicyDetail(null);
      }

      await loadPolicies();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete policy.' });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredPolicies = policies.filter((p) => {
    const q = policySearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.source_name && p.source_name.toLowerCase().includes(q)) ||
      (p.uploaded_by_username && p.uploaded_by_username.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8">
      {/* Page Header with Main Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Policy Management & Ingestion
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ingest compliance handbooks, review machine-extracted regulatory rules, and manage persistent policies.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('ingest')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'ingest'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ingest & Analyze
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('repository')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'repository'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Policy Repository</span>
            {policies.length > 0 && (
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[10px]">
                {policies.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {feedback && (
        <Alert variant={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* TAB 1: INGEST & ANALYZE */}
      {activeTab === 'ingest' && (
        <div className="grid gap-6 lg:grid-cols-12 animate-fade-in">
          {/* Left Column: Form & Ingestion (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Policy Input</CardTitle>
                    <CardDescription>Enter text or upload legal contracts and audit policies</CardDescription>
                  </div>

                  {/* Mode Selector Pill */}
                  <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setInputMode('text')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        inputMode === 'text'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Direct Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('file')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        inputMode === 'file'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Upload Document
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleAnalyze} className="space-y-5">
                  <Input
                    label="Policy Title"
                    placeholder="e.g. ISO 27001 Access Management Policy"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />

                  {inputMode === 'text' ? (
                    <Textarea
                      label="Policy Text Content"
                      placeholder="Paste policy clauses, requirements, privacy statements, or compliance rules..."
                      rows={8}
                      value={policyText}
                      onChange={(e) => setPolicyText(e.target.value)}
                      helperText="Supports markdown or raw text. Minimum 50 words recommended for optimal rule extraction."
                    />
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-700">
                        Upload File (.pdf, .docx, .txt)
                      </label>

                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition cursor-pointer text-center ${
                          isDragging
                            ? 'border-blue-500 bg-blue-50/50'
                            : policyFile
                            ? 'border-emerald-400 bg-emerald-50/30'
                            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.txt,.docx"
                          onChange={handleFileChange}
                          className="hidden"
                        />

                        {policyFile ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                              <FileCheck2 className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{policyFile.name}</p>
                              <p className="text-xs text-slate-500">
                                {(policyFile.size / 1024).toFixed(1)} KB • Ready for extraction
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPolicyFile(null);
                              }}
                              className="text-xs text-red-600 hover:underline mt-1"
                            >
                              Remove file
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                              <UploadCloud className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                Click to browse or drag and drop document
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                Supports PDF, Word (DOCX), or plain TXT up to 10MB
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quick Presets */}
                  <div className="pt-2">
                    <span className="text-xs font-semibold text-slate-500 block mb-2">
                      Or load pre-configured enterprise sample:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {SAMPLE_POLICIES.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => loadSample(s)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
                        >
                          {s.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {!isComplianceOrAdmin() && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      Policy ingestion and rule interpretation requires Compliance Officer or Administrator role.
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <Button
                      type="submit"
                      loading={analyzing}
                      disabled={!isComplianceOrAdmin()}
                      icon={Sparkles}
                      size="md"
                      className="flex-1 sm:flex-none"
                    >
                      {isComplianceOrAdmin() ? 'Analyze Policy' : 'Analyze (Compliance/Admin Only)'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      loading={saving}
                      disabled={!isComplianceOrAdmin()}
                      icon={Save}
                      size="md"
                      onClick={handleSavePolicy}
                      className="flex-1 sm:flex-none"
                    >
                      {isComplianceOrAdmin() ? 'Save Policy' : 'Save (Compliance/Admin Only)'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Interpretation Output (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="h-full">
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Extracted Intelligence</CardTitle>
                  <CardDescription>Normalized rules and recommended enforcement actions</CardDescription>
                </div>
                {result && (
                  <Badge variant="medium">
                    {result.confidence || `${result.actions?.length || 0} Rules`}
                  </Badge>
                )}
              </CardHeader>

              <CardContent>
                {result ? (
                  <div className="space-y-6 animate-fade-in">
                    {/* Meta Specs */}
                    <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block font-semibold uppercase">Source</span>
                        <span className="font-bold text-slate-800 line-clamp-1">{result.source}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold uppercase">Complexity</span>
                        <span className="font-bold text-blue-700">
                          {result.complexity_label || 'Normal'} ({result.complexity_score || 0}/100)
                        </span>
                      </div>
                    </div>

                    {/* Policy Summary */}
                    {result.summary && (
                      <div>
                        <h5 className="text-xs font-medium text-slate-500 mb-2">
                          Executive summary
                        </h5>
                        <div className="p-3.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 leading-relaxed font-sans border-l-4 border-l-blue-700">
                          {result.summary}
                        </div>
                      </div>
                    )}

                    {/* Actions List */}
                    <div>
                      <h5 className="text-xs font-medium text-slate-500 mb-3">
                        Extracted enforcement rules ({result.actions?.length || 0})
                      </h5>

                      <div className="space-y-3">
                        {result.actions && result.actions.length > 0 ? (
                          result.actions.map((act, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 hover:border-slate-300 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-semibold text-slate-900 leading-snug">
                                  {act.title}
                                </p>
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 shrink-0">
                                  {act.impact || 'Clause'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600">
                                <span className="font-semibold text-slate-700">Trigger:</span> {act.description}
                              </p>
                              <p className="text-xs text-slate-500">
                                <span className="font-semibold text-slate-700">Audit Action:</span> {act.risk}
                              </p>
                            </div>
                          ))
                        ) : (
                          <EmptyState
                            title="No rules extracted"
                            description="The engine did not detect actionable policy clauses in the input."
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={Sparkles}
                    title="Ready for Analysis"
                    description="Submit policy text or upload a document on the left, then click 'Analyze Policy' to run the extraction engine."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: POLICY REPOSITORY */}
      {activeTab === 'repository' && (
        <div className="space-y-6 animate-fade-in">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search policies by title or author..."
                value={policySearch}
                onChange={(e) => setPolicySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                icon={RotateCw}
                loading={loadingPolicies}
                onClick={loadPolicies}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                icon={Sparkles}
                onClick={() => setActiveTab('ingest')}
              >
                Ingest New
              </Button>
            </div>
          </div>

          {/* Edit Policy Inline Form */}
          {editingPolicy && (
            <Card className="border-blue-300 bg-blue-50/20 animate-fade-in">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-blue-600" />
                    <span>Edit Policy: {editingPolicy.title}</span>
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setEditingPolicy(null)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <Input
                    label="Policy Title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                  <Textarea
                    label="Policy Content (Saving updates will re-extract rules)"
                    rows={6}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingPolicy(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      icon={Save}
                      loading={updatingPolicy}
                    >
                      Save Changes
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Policies Table */}
          <Card>
            <CardHeader>
              <CardTitle>Registered Policies</CardTitle>
              <CardDescription>
                Showing {filteredPolicies.length} of {policies.length} compliance handbooks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPolicies ? (
                <TableRowSkeleton count={4} />
              ) : filteredPolicies.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Title</th>
                        <th className="py-3 px-4">Source</th>
                        <th className="py-3 px-4">Author</th>
                        <th className="py-3 px-4">Date Ingested</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredPolicies.map((p) => {
                        const hasDocument = Boolean(p.document);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                <span className="font-semibold text-slate-900">{p.title}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              <span className="truncate max-w-[180px] block" title={p.source_name}>
                                {p.source_name || 'Direct text'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-medium">
                              {p.uploaded_by_username || 'System'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500">
                              {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={Eye}
                                  title="View Details & Extracted Rules"
                                  onClick={() => handleViewPolicy(p.id)}
                                >
                                  Rules
                                </Button>

                                {hasDocument && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={Download}
                                    title="Download Document"
                                    onClick={() => handleDownloadDocument(p.id, p.title)}
                                  >
                                    PDF
                                  </Button>
                                )}

                                {isComplianceOrAdmin() && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      icon={Edit3}
                                      title="Edit Policy"
                                      onClick={() => handleStartEdit(p)}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      icon={Trash2}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      title="Delete Policy"
                                      loading={deletingId === p.id}
                                      onClick={() => handleDeletePolicy(p.id, p.title)}
                                    />
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={FolderOpen}
                  title="No Policies Found"
                  description={
                    policySearch
                      ? 'No policies match your search query.'
                      : 'No policies have been registered yet. Ingest your first policy above.'
                  }
                  actionLabel={policySearch ? 'Clear Search' : 'Ingest Policy'}
                  onAction={() => {
                    if (policySearch) setPolicySearch('');
                    else setActiveTab('ingest');
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* Selected Policy Rules Drawer / Inspector */}
          {selectedPolicyDetail && (
            <Card className="border-blue-200 bg-slate-50/50 animate-fade-in">
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      {selectedPolicyDetail.policy?.title}
                    </CardTitle>
                  </div>
                  <CardDescription className="mt-1">
                    Source: {selectedPolicyDetail.policy?.source_name || 'Direct text'} • Extracted Rules: {selectedPolicyDetail.rules?.length || 0}
                  </CardDescription>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPolicyDetail(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPolicyDetail.policy?.content_text && (
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans max-h-48 overflow-y-auto">
                    <strong>Full Policy Text:</strong>
                    <p className="mt-1 whitespace-pre-wrap">{selectedPolicyDetail.policy.content_text}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-wider">
                    Extracted Active Regulatory Rules ({selectedPolicyDetail.rules?.length || 0})
                  </h4>
                  {selectedPolicyDetail.rules && selectedPolicyDetail.rules.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedPolicyDetail.rules.map((rule) => (
                        <div
                          key={rule.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">
                              {rule.description || 'Regulatory Clause'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800">
                              Active
                            </span>
                          </div>
                          {rule.condition && (
                            <p className="text-xs text-slate-600">
                              <span className="font-semibold text-slate-700">Trigger:</span> {rule.condition}
                            </p>
                          )}
                          {rule.action && (
                            <p className="text-xs text-slate-500">
                              <span className="font-semibold text-slate-700">Enforcement:</span> {rule.action}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No discrete rules found for this policy.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
