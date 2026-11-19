import type { User } from 'firebase/auth';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BookmarkPlus,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  Gauge,
  Info,
  KeyRound,
  ListChecks,
  Loader2,
  PenLine,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type {
  ATSAnalysisResult,
  ExtractedResume,
  ResumeImproverResult,
  SavedAnalysisSession,
} from '../types/ats';
import { downloadAtsPdfReport } from '../utils/pdfReport';
import { ScoreGauge } from './ScoreGauge';
import { ScoreHistorySection } from './ScoreHistorySection';

interface AnalysisDashboardProps {
  analysis: ATSAnalysisResult;
  resume: ExtractedResume;
  jobDescription: string;
  analyzedAt: Date;
  onAnalyzeAnother: () => void;
  user: User | null;
  authReady: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  sessions: SavedAnalysisSession[];
  historyLoading: boolean;
  historyError: string | null;
  activeSavedSessionId: string | null;
  onSaveSession: (label: string, targetRole: string) => Promise<void>;
  onLoadSession: (session: SavedAnalysisSession) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

type DashboardTab = 'overview' | 'keywords' | 'recommendations' | 'improver' | 'history';
type KeywordFilter = 'all' | 'matched' | 'missing' | 'technical' | 'suggested';

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-emerald-300">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 text-zinc-400" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

function getBarColorClass(score: number): string {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 70) return 'bg-sky-400';
  if (score >= 50) return 'bg-amber-400';
  return 'bg-rose-500';
}

export function AnalysisDashboard({
  analysis,
  resume,
  jobDescription,
  analyzedAt,
  onAnalyzeAnother,
  user,
  authReady,
  onSignIn,
  onSignOut,
  sessions,
  historyLoading,
  historyError,
  activeSavedSessionId,
  onSaveSession,
  onLoadSession,
  onDeleteSession,
}: AnalysisDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [keywordFilter, setKeywordFilter] = useState<KeywordFilter>('all');
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [isImproving, setIsImproving] = useState(false);
  const [improverError, setImproverError] = useState<string | null>(null);
  const [improverResult, setImproverResult] = useState<ResumeImproverResult | null>(null);

  const canRunLiveImprover = resume.text.trim().length >= 40 && jobDescription.trim().length >= 30;

  const breakdownRows = [
    { label: 'Keyword Match', weight: '25%', score: analysis.scoreBreakdown.keywordMatch },
    { label: 'Technical Skills', weight: '20%', score: analysis.scoreBreakdown.technicalSkills },
    { label: 'Work Experience', weight: '20%', score: analysis.scoreBreakdown.workExperience },
    {
      label: 'Job Title & Role Relevance',
      weight: '10%',
      score: analysis.scoreBreakdown.jobTitleRelevance,
    },
    {
      label: 'Education & Certifications',
      weight: '10%',
      score: analysis.scoreBreakdown.educationCertifications,
    },
    {
      label: 'Resume Structure & Readability',
      weight: '10%',
      score: analysis.scoreBreakdown.formattingReadability,
    },
    { label: 'Soft Skills', weight: '5%', score: analysis.scoreBreakdown.softSkills },
  ];

  const handleImproveResume = async () => {
    if (!canRunLiveImprover) return;
    setIsImproving(true);
    setImproverError(null);
    try {
      const response = await fetch('/api/improve-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resume.text,
          jobDescription,
          suggestedKeywords: analysis.suggestedKeywords,
        }),
      });
      const data = (await response.json()) as ResumeImproverResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Unable to generate resume improvements.');
      }
      setImproverResult(data);
    } catch (err: unknown) {
      setImproverError(
        err instanceof Error ? err.message : 'Failed to generate improved resume content.'
      );
    } finally {
      setIsImproving(false);
    }
  };

  const toggleChecklistItem = (idx: number) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const completedChecklistCount = analysis.optimizationChecklist.filter(
    (_, idx) => checkedItems[idx]
  ).length;

  const displayedSummary =
    improverResult?.improvedSummary || analysis.improvedProfessionalSummary;
  const displayedBullets =
    improverResult?.rewrittenBullets && improverResult.rewrittenBullets.length > 0
      ? improverResult.rewrittenBullets
      : analysis.improvedBulletPoints;

  const formattedDate = analyzedAt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const navItems: Array<{
    id: DashboardTab;
    label: string;
    icon: typeof Gauge;
    meta?: string;
  }> = [
    { id: 'overview', label: 'Overview & Breakdown', icon: Gauge },
    {
      id: 'keywords',
      label: 'Keyword Diagnostics',
      icon: KeyRound,
      meta: `${analysis.matchedKeywords.length}/${analysis.matchedKeywords.length + analysis.missingKeywords.length}`,
    },
    {
      id: 'recommendations',
      label: 'Advice & Checklist',
      icon: ListChecks,
      meta: `${completedChecklistCount}/${analysis.optimizationChecklist.length}`,
    },
    { id: 'improver', label: 'AI Resume Improver', icon: PenLine },
    {
      id: 'history',
      label: 'Score History',
      icon: TrendingUp,
      meta: sessions.length > 0 ? `${sessions.length}` : undefined,
    },
  ];

  return (
    <div id="workspace-main" className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        {/* Persistent Sidebar Workspace Rail */}
        <aside className="w-full lg:w-[272px] shrink-0 lg:sticky lg:top-24 space-y-4">
          {/* Compact Resume & Score Identity Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-4">
            <button
              type="button"
              onClick={onAnalyzeAnother}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors mb-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to upload</span>
            </button>

            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-2xl font-bold text-zinc-50 tabular-nums">
                {analysis.overallScore}
                <span className="text-xs font-normal text-zinc-500">/100</span>
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                {analysis.scoreCategory}
              </span>
            </div>

            <p className="mt-2 truncate text-xs font-medium text-zinc-200" title={resume.filename}>
              {resume.filename}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 tabular-nums">
              <span>{resume.wordCount} words</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{formattedDate}</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav
            aria-label="Dashboard workspace views"
            className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.meta && (
                    <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                      {item.meta}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Primary Utilities */}
          <div className="hidden lg:flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-100 hover:border-emerald-500/50 hover:bg-zinc-800 transition-colors whitespace-nowrap"
            >
              <BookmarkPlus className="h-4 w-4 text-emerald-400" />
              <span>Save &amp; Track Score</span>
            </button>

            <button
              type="button"
              onClick={() =>
                downloadAtsPdfReport(
                  analysis,
                  { filename: resume.filename, analyzedAt },
                  improverResult
                )
              }
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Download Report (PDF)</span>
            </button>
          </div>
        </aside>

        {/* Main Workspace Content Viewport */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          {/* Top Workspace Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 px-5 py-4">
            <div>
              <div className="text-xs text-zinc-500">
                Report <span aria-hidden="true">/</span>{' '}
                <span className="text-zinc-300">
                  {navItems.find((n) => n.id === activeTab)?.label}
                </span>
              </div>
              <h1 className="mt-0.5 font-display text-xl sm:text-2xl font-bold tracking-tight text-zinc-50">
                {navItems.find((n) => n.id === activeTab)?.label}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0 lg:hidden">
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-emerald-500/50 transition-colors"
              >
                <BookmarkPlus className="h-3.5 w-3.5 text-emerald-400" />
                <span>Save Session</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadAtsPdfReport(
                    analysis,
                    { filename: resume.filename, analyzedAt },
                    improverResult
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>PDF Report</span>
              </button>
            </div>
          </div>

          {/* Explicit AI Estimate Disclaimer */}
          <div
            id="disclaimer"
            className="flex items-start gap-3 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-xs leading-relaxed text-zinc-300"
          >
            <Info className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
            <p>
              <strong className="font-semibold text-zinc-100">AI-Generated Estimate:</strong>{' '}
              This compatibility score is an AI-generated estimate based on weighted keyword alignment, skills coverage, and ATS readability standards—not a guaranteed score from any specific employer or ATS platform.
            </p>
          </div>

          {/* VIEW 1: OVERVIEW & BREAKDOWN */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <section
                id="score-overview"
                className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
              >
                <div className="lg:col-span-5 rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-7 flex flex-col items-center justify-center">
                  <h2 className="font-display text-sm font-semibold text-zinc-400 mb-5">
                    Overall ATS Score
                  </h2>
                  <ScoreGauge score={analysis.overallScore} category={analysis.scoreCategory} />
                </div>

                <div className="lg:col-span-7 rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-7 flex flex-col justify-between">
                  <div>
                    <div className="flex items-baseline justify-between gap-4 mb-5">
                      <h2 className="font-display text-base font-semibold text-zinc-100">
                        Weighted Category Breakdown
                      </h2>
                      <span className="font-mono text-xs text-zinc-500 tabular-nums">
                        Total 100%
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {breakdownRows.map((row) => (
                        <div key={row.label}>
                          <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-zinc-200">{row.label}</span>
                              <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                                ({row.weight})
                              </span>
                            </div>
                            <span className="font-mono text-xs sm:text-sm font-semibold text-zinc-100 tabular-nums">
                              {row.score}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getBarColorClass(row.score)}`}
                              style={{
                                width: `${row.score}%`,
                                transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {analysis.summaryFeedback && (
                    <div className="mt-6 pt-5 border-t border-zinc-800">
                      <p className="text-xs font-semibold text-zinc-400 mb-1">
                        Executive Summary
                      </p>
                      <p className="text-sm leading-relaxed text-zinc-300">
                        {analysis.summaryFeedback}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Strengths & Weaknesses */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <h2 className="font-display text-base font-semibold text-zinc-100">
                      Key Strengths
                    </h2>
                  </div>
                  {analysis.strengths.length > 0 ? (
                    <ul className="space-y-3">
                      {analysis.strengths.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2.5 text-sm text-zinc-300 leading-relaxed"
                        >
                          <Check className="h-4 w-4 shrink-0 text-emerald-400 mt-1" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-zinc-500">No strengths recorded.</p>
                  )}
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    <h2 className="font-display text-base font-semibold text-zinc-100">
                      Weaknesses &amp; Gaps
                    </h2>
                  </div>
                  {analysis.weaknesses.length > 0 ? (
                    <ul className="space-y-3">
                      {analysis.weaknesses.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2.5 text-sm text-zinc-300 leading-relaxed"
                        >
                          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-1" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-zinc-500">No major weaknesses identified.</p>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* VIEW 2: KEYWORD DIAGNOSTICS */}
          {activeTab === 'keywords' && (
            <section
              id="keyword-analysis"
              className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-7"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-zinc-800">
                <div>
                  <h2 className="font-display text-lg font-semibold text-zinc-100">
                    Keyword &amp; Skills Alignment
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    <span className="font-mono tabular-nums text-emerald-400 font-medium">
                      {analysis.matchedKeywords.length} matched
                    </span>
                    <span aria-hidden="true" className="mx-2 text-zinc-600">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-rose-400 font-medium">
                      {analysis.missingKeywords.length} missing
                    </span>
                    <span aria-hidden="true" className="mx-2 text-zinc-600">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-sky-400 font-medium">
                      {analysis.suggestedKeywords.length} suggested
                    </span>
                  </p>
                </div>

                <div
                  role="tablist"
                  aria-label="Keyword filter"
                  className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1"
                >
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'matched', label: 'Matched' },
                      { id: 'missing', label: 'Missing' },
                      { id: 'technical', label: 'Technical Gaps' },
                      { id: 'suggested', label: 'Suggested' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={keywordFilter === tab.id}
                      onClick={() => setKeywordFilter(tab.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        keywordFilter === tab.id
                          ? 'bg-emerald-500 text-zinc-950 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {(keywordFilter === 'all' || keywordFilter === 'matched') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <h3 className="text-sm font-semibold text-zinc-100">
                        Matched Keywords ({analysis.matchedKeywords.length})
                      </h3>
                    </div>
                    {analysis.matchedKeywords.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {analysis.matchedKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300"
                          >
                            <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                            <span>{kw}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">No direct keyword matches found.</p>
                    )}
                  </div>
                )}

                {(keywordFilter === 'all' || keywordFilter === 'missing') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <XCircle className="h-4 w-4 text-rose-400" />
                      <h3 className="text-sm font-semibold text-zinc-100">
                        Missing Keywords ({analysis.missingKeywords.length})
                      </h3>
                    </div>
                    {analysis.missingKeywords.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {analysis.missingKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300"
                          >
                            <XCircle className="h-3 w-3 text-rose-400 shrink-0" />
                            <span>{kw}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">No major missing keywords detected.</p>
                    )}
                  </div>
                )}

                {(keywordFilter === 'all' || keywordFilter === 'technical') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-rose-400" />
                      <h3 className="text-sm font-semibold text-zinc-100">
                        Missing Technical Skills ({analysis.missingTechnicalSkills.length})
                      </h3>
                    </div>
                    {analysis.missingTechnicalSkills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {analysis.missingTechnicalSkills.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300"
                          >
                            <AlertCircle className="h-3 w-3 text-rose-400 shrink-0" />
                            <span>{skill}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">
                        All core technical requirements appear represented.
                      </p>
                    )}
                  </div>
                )}

                {(keywordFilter === 'all' || keywordFilter === 'suggested') && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <PenLine className="h-4 w-4 text-sky-400" />
                      <h3 className="text-sm font-semibold text-zinc-100">
                        Suggested Keywords to Incorporate ({analysis.suggestedKeywords.length})
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-400 mb-3">
                      Only includes phrasing supported by experience already evident in your resume.
                    </p>
                    {analysis.suggestedKeywords.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {analysis.suggestedKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-300"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">
                        No additional experience-supported keyword phrasing identified.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {keywordFilter === 'all' && analysis.industryKeywords.length > 0 && (
                <div className="mt-6 pt-5 border-t border-zinc-800">
                  <h3 className="text-xs font-semibold text-zinc-400 mb-2">
                    Relevant Industry-Specific Keywords in Target Role
                  </h3>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {analysis.industryKeywords.join(' · ')}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* VIEW 3: RECOMMENDATIONS & CHECKLIST */}
          {activeTab === 'recommendations' && (
            <div className="space-y-6">
              <section
                id="recommendations"
                className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-7"
              >
                <div className="mb-6">
                  <h2 className="font-display text-lg font-semibold text-zinc-100">
                    Targeted Improvement Recommendations
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Actionable guidance across summary, experience, skills, formatting, and action verbs.
                  </p>
                </div>

                {analysis.categorizedRecommendations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.categorizedRecommendations.map((rec, idx) => {
                      const priorityStyle =
                        rec.priority === 'High'
                          ? 'text-rose-300 bg-rose-500/10 border-rose-500/30'
                          : rec.priority === 'Medium'
                          ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                          : 'text-zinc-300 bg-zinc-800 border-zinc-700';
                      return (
                        <div
                          key={`${rec.area}-${idx}`}
                          className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-semibold text-zinc-100">
                              {rec.area}
                            </span>
                            <span
                              className={`rounded border px-2 py-0.5 text-[11px] font-medium ${priorityStyle}`}
                            >
                              {rec.priority} Priority
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed text-zinc-300">{rec.advice}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ul className="space-y-2.5 text-sm text-zinc-300">
                    {analysis.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="font-mono text-xs font-semibold text-emerald-400 mt-0.5">
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {analysis.optimizationChecklist.length > 0 && (
                <section className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-7">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-emerald-400" />
                      <h2 className="font-display text-lg font-semibold text-zinc-100">
                        Resume Optimization Checklist
                      </h2>
                    </div>
                    <span className="font-mono text-xs font-medium text-zinc-400 tabular-nums">
                      {completedChecklistCount} of {analysis.optimizationChecklist.length} completed
                    </span>
                  </div>

                  <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
                    {analysis.optimizationChecklist.map((item, idx) => {
                      const checked = Boolean(checkedItems[idx]);
                      return (
                        <label
                          key={idx}
                          className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${
                            checked ? 'bg-zinc-950/90' : 'bg-zinc-950/40 hover:bg-zinc-800/40'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleChecklistItem(idx)}
                            className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                          />
                          <span
                            className={`text-sm leading-relaxed ${
                              checked ? 'line-through text-zinc-500' : 'text-zinc-200'
                            }`}
                          >
                            {item}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* VIEW 4: AI RESUME IMPROVER */}
          {activeTab === 'improver' && (
            <section
              id="resume-improver"
              className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-7"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-zinc-800">
                <div>
                  <h2 className="font-display text-lg font-semibold text-zinc-100">
                    AI Resume Improver
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Rewrites your summary and bullet points for ATS clarity using only your factual experience.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleImproveResume()}
                  disabled={isImproving || !canRunLiveImprover}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  {isImproving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Generating Rewrite...</span>
                    </>
                  ) : (
                    <>
                      <PenLine className="h-4 w-4" />
                      <span>{improverResult ? 'Regenerate Improvements' : 'Improve My Resume'}</span>
                    </>
                  )}
                </button>
              </div>

              {!canRunLiveImprover && (
                <p className="mt-4 text-xs text-zinc-400">
                  Viewing a saved historical session. Upload the resume file again to generate fresh AI bullet rewrites.
                </p>
              )}

              {improverError && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{improverError}</span>
                </div>
              )}

              <div className="mt-6 space-y-8">
                {displayedSummary && (
                  <div>
                    <div className="flex items-center justify-between gap-4 mb-2.5">
                      <h3 className="text-sm font-semibold text-zinc-100">
                        Optimized Professional Summary
                      </h3>
                      <CopyButton text={displayedSummary} label="Copy summary" />
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm leading-relaxed text-zinc-200">
                      {displayedSummary}
                    </div>
                  </div>
                )}

                {improverResult?.optimizedSkillsSection && (
                  <div>
                    <div className="flex items-center justify-between gap-4 mb-2.5">
                      <h3 className="text-sm font-semibold text-zinc-100">
                        ATS-Aligned Skills Section (Verified From Resume)
                      </h3>
                      <CopyButton text={improverResult.optimizedSkillsSection} label="Copy skills" />
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm leading-relaxed text-zinc-200 whitespace-pre-line">
                      {improverResult.optimizedSkillsSection}
                    </div>
                  </div>
                )}

                {displayedBullets.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <h3 className="text-sm font-semibold text-zinc-100">
                        Before &amp; After Bullet Point Upgrades ({displayedBullets.length})
                      </h3>
                      <CopyButton
                        text={displayedBullets.map((b) => `• ${b.improved}`).join('\n')}
                        label="Copy all bullets"
                      />
                    </div>

                    <div className="space-y-4">
                      {displayedBullets.map((bullet, idx) => (
                        <div key={idx} className="rounded-lg border border-zinc-800 overflow-hidden">
                          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
                            <div className="bg-zinc-950/80 p-4">
                              <span className="text-[11px] font-semibold text-zinc-500 block mb-1.5">
                                Original Bullet
                              </span>
                              <p className="text-sm leading-relaxed text-zinc-400">
                                {bullet.original}
                              </p>
                            </div>
                            <div className="bg-zinc-900/60 p-4">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-[11px] font-semibold text-emerald-400">
                                  ATS-Optimized Rewrite
                                </span>
                                <CopyButton text={bullet.improved} />
                              </div>
                              <p className="text-sm leading-relaxed font-medium text-zinc-100">
                                {bullet.improved}
                              </p>
                            </div>
                          </div>
                          {bullet.reason && (
                            <div className="border-t border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-xs text-zinc-400">
                              <strong className="font-semibold text-zinc-300">Why this helps:</strong>{' '}
                              {bullet.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {improverResult?.tailoringNotes && (
                  <p className="text-xs leading-relaxed text-zinc-400 border-t border-zinc-800 pt-4">
                    {improverResult.tailoringNotes}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* VIEW 5: SCORE HISTORY & RECHARTS TRENDS */}
          {activeTab === 'history' && (
            <ScoreHistorySection
              user={user}
              authReady={authReady}
              onSignIn={onSignIn}
              onSignOut={onSignOut}
              sessions={sessions}
              historyLoading={historyLoading}
              historyError={historyError}
              currentAnalysis={analysis}
              currentResume={resume}
              currentJobDescription={jobDescription}
              activeSavedSessionId={activeSavedSessionId}
              onSaveSession={onSaveSession}
              onLoadSession={onLoadSession}
              onDeleteSession={onDeleteSession}
            />
          )}
        </main>
      </div>
    </div>
  );
}
