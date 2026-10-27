import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  FileText,
  Activity,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Send,
} from 'lucide-react';
import Button from '../components/ui/Button';

export default function LandingPage() {
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleContactSubmit = (e) => {
    e.preventDefault();
    setContactSubmitted(true);
    setTimeout(() => {
      setContactSubmitted(false);
      setName('');
      setEmail('');
      setMessage('');
    }, 4000);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 sm:px-6 md:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white group-hover:bg-blue-700 transition-colors">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-headline font-bold text-lg tracking-tight text-slate-900">
                Sentinel Core
              </span>
              <span className="ml-2 text-xs font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Enterprise
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-700">
            <a href="#features" className="hover:text-blue-700 transition-colors">Capabilities</a>
            <a href="#frameworks" className="hover:text-blue-700 transition-colors">Frameworks</a>
            <a href="#metrics" className="hover:text-blue-700 transition-colors">Metrics</a>
            <a href="#contact" className="hover:text-blue-700 transition-colors">Contact</a>
          </div>

          <div className="flex items-center gap-2.5">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">
                Open Workspace
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="pt-12 md:pt-20 pb-16 px-4 sm:px-6 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 border border-blue-200 text-xs font-medium text-blue-800 mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Policy Intelligence & Compliance Monitoring</span>
          </div>

          <h1 className="font-headline text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.18]">
            Continuous Compliance &amp;
            <br />
            <span className="text-blue-700">Automated Controls</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-700 max-w-2xl mx-auto leading-relaxed">
            Ingest unstructured PDF and DOCX policy documents, continuously monitor employee activity
            against regulatory standards, and automate compliance audits across GDPR, SOC 2, and HIPAA.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Link to="/dashboard">
              <Button size="lg" icon={ArrowRight} iconPosition="right">
                Launch Workspace
              </Button>
            </Link>
            <Link to="/policies">
              <Button variant="outline" size="lg" icon={Sparkles}>
                Policy Interpreter
              </Button>
            </Link>
          </div>

          {/* Social Proof Stats */}
          <div id="metrics" className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
            <div className="p-4 md:p-5 rounded-xl bg-white border border-slate-200">
              <p className="font-headline text-2xl md:text-3xl font-bold text-slate-900 tabular-nums">99.8%</p>
              <p className="mt-1 text-xs md:text-sm text-slate-600 font-medium">Policy Extraction Precision</p>
            </div>
            <div className="p-4 md:p-5 rounded-xl bg-white border border-slate-200">
              <p className="font-headline text-2xl md:text-3xl font-bold text-blue-700 tabular-nums">10x</p>
              <p className="mt-1 text-xs md:text-sm text-slate-600 font-medium">Audit Preparation Speed</p>
            </div>
            <div className="p-4 md:p-5 rounded-xl bg-white border border-slate-200">
              <p className="font-headline text-2xl md:text-3xl font-bold text-slate-900 tabular-nums">500+</p>
              <p className="mt-1 text-xs md:text-sm text-slate-600 font-medium">Mapped Control Clauses</p>
            </div>
            <div className="p-4 md:p-5 rounded-xl bg-white border border-slate-200">
              <p className="font-headline text-2xl md:text-3xl font-bold text-emerald-700 tabular-nums">0ms</p>
              <p className="mt-1 text-xs md:text-sm text-slate-600 font-medium">Local Engine Latency</p>
            </div>
          </div>
        </div>
      </header>

      {/* Feature Section */}
      <section id="features" className="py-16 md:py-24 bg-white border-t border-slate-200 px-4 sm:px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-semibold text-blue-800 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
              Core Capabilities
            </span>
            <h2 className="mt-3 font-headline text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Architected for Enterprise Compliance
            </h2>
            <p className="mt-2 text-sm md:text-base text-slate-700">
              Transform unstructured legal contracts and employee handbooks into deterministic real-time monitoring controls.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <FileText className="w-6 h-6 text-blue-700" />
              <h3 className="font-headline text-lg font-bold text-slate-900">
                Multi-Format Ingestion
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Ingest PDF files, DOCX documents, or raw text directly. Our native parser extracts structured rules, requirements, and owner actions.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <Activity className="w-6 h-6 text-amber-700" />
              <h3 className="font-headline text-lg font-bold text-slate-900">
                Continuous Risk Simulation
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Simulate internal activity streams (e.g. data downloads, external sharing) against active policy rules to trigger instant alert triage.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <ShieldCheck className="w-6 h-6 text-emerald-700" />
              <h3 className="font-headline text-lg font-bold text-slate-900">
                Automated Audit Alignment
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Dynamic telemetry calculates compliance coverage scores across GDPR, SOC 2 Type II, and HIPAA benchmarks in real time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Frameworks Section */}
      <section id="frameworks" className="py-16 md:py-24 bg-slate-50 border-t border-slate-200 px-4 sm:px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-semibold text-blue-800 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                Framework Coverage
              </span>
              <h2 className="mt-2 font-headline text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                Continuous Compliance Benchmarks
              </h2>
            </div>
            <Link
              to="/frameworks"
              className="text-sm font-semibold text-blue-700 hover:text-blue-900 transition-colors flex items-center gap-1"
            >
              Explore Full Coverage &rarr;
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
              <span className="text-xs font-medium text-slate-600">European Union</span>
              <h3 className="font-headline text-xl font-bold text-slate-900">GDPR 2016/679</h3>
              <p className="text-sm text-slate-700">
                Data protection, user consent tracking, and erasure workflow verification.
              </p>
              <div className="pt-3 border-t border-slate-200">
                <span className="text-xs font-medium text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Continuous Auditing Active
                </span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
              <span className="text-xs font-medium text-slate-600">United States</span>
              <h3 className="font-headline text-xl font-bold text-slate-900">SOC 2 Type II</h3>
              <p className="text-sm text-slate-700">
                Security, availability, confidentiality, and processing integrity audit readiness.
              </p>
              <div className="pt-3 border-t border-slate-200">
                <span className="text-xs font-medium text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Continuous Auditing Active
                </span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
              <span className="text-xs font-medium text-slate-600">Healthcare Standard</span>
              <h3 className="font-headline text-xl font-bold text-slate-900">HIPAA Security Rule</h3>
              <p className="text-sm text-slate-700">
                Protected Health Information (ePHI) safeguards and transmission access control.
              </p>
              <div className="pt-3 border-t border-slate-200">
                <span className="text-xs font-medium text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Continuous Auditing Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 md:py-24 bg-white border-t border-slate-200 px-4 sm:px-6 md:px-8">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-headline text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Connect with Compliance Engineers
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Questions about integrating with custom DLP solutions or dedicated enterprise deployment?
            </p>
          </div>

          <form onSubmit={handleContactSubmit} className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            {contactSubmitted && (
              <div className="p-3.5 rounded-lg bg-emerald-50 text-emerald-900 text-sm font-medium border border-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
                <span>Thank you. A compliance engineer will reach out within 24 hours.</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Elena Rostova"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Work Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Message
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your organization's policy compliance objectives..."
                className="w-full p-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-blue-700"
              />
            </div>

            <Button type="submit" fullWidth icon={Send} size="md">
              Send Message
            </Button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-slate-900 text-slate-300 text-sm px-4 sm:px-6 md:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-bold text-white text-sm">Sentinel Core</span>
            <span className="text-xs text-slate-400">&copy; 2026 Sentinel Compliance Suite</span>
          </div>

          <div className="flex flex-wrap gap-5 text-xs font-medium text-slate-300">
            <Link to="/login" className="hover:text-white transition-colors">Workspace Login</Link>
            <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link to="/policies" className="hover:text-white transition-colors">Policy Interpreter</Link>
            <Link to="/monitoring" className="hover:text-white transition-colors">Real-Time Monitoring</Link>
            <Link to="/frameworks" className="hover:text-white transition-colors">Frameworks</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
