import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import { apiRequest, isComplianceOrAdmin } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Input, Textarea } from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import EmptyState from '../components/ui/EmptyState';

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
        message: `Policy "${data.title}" saved to MongoDB successfully with ${data.rules_created} persistent rule(s).`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save policy.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Policy Interpreter & Ingestion
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Parse unstructured compliance documents, extract machine-readable rules, and persist regulatory requirements.
        </p>
      </div>

      {feedback && (
        <Alert variant={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
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
                              Supports PDF, Word (DOCX), or plain TXT up to 20MB
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
    </div>
  );
}
