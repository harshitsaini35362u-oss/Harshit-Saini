import type { User } from 'firebase/auth';
import {
  AlertCircle,
  BookmarkCheck,
  BookmarkPlus,
  Eye,
  Loader2,
  LogIn,
  LogOut,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SESSION_LIMITS } from '../services/analysisHistory';
import type { ATSAnalysisResult, ExtractedResume, SavedAnalysisSession } from '../types/ats';

interface ScoreHistorySectionProps {
  user: User | null;
  authReady: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  sessions: SavedAnalysisSession[];
  historyLoading: boolean;
  historyError: string | null;
  currentAnalysis?: ATSAnalysisResult | null;
  currentResume?: ExtractedResume | null;
  currentJobDescription?: string;
  activeSavedSessionId?: string | null;
  onSaveSession?: (label: string, targetRole: string) => Promise<void>;
  onLoadSession: (session: SavedAnalysisSession) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

type ChartMode = 'overall' | 'breakdown';

interface ChartPoint {
  index: number;
  shortLabel: string;
  sessionLabel: string;
  targetRole: string;
  resumeFilename: string;
  dateFormatted: string;
  overallScore: number;
  scoreCategory: string;
  keywordMatch: number;
  technicalSkills: number;
  workExperience: number;
  delta: number | null;
}

function CustomChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3.5 shadow-xl text-xs max-w-[260px]">
      <p className="font-semibold text-zinc-100 truncate">{pt.sessionLabel}</p>
      {pt.targetRole && (
        <p className="text-zinc-400 truncate mt-0.5">{pt.targetRole}</p>
      )}
      <p className="font-mono text-[11px] text-zinc-500 mt-1">{pt.dateFormatted}</p>

      <div className="mt-2.5 pt-2 border-t border-zinc-800 space-y-1 font-mono tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-zinc-400">Overall ATS</span>
          <span className="font-bold text-zinc-50">{pt.overallScore}/100</span>
        </div>
        {pt.delta !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="font-sans text-zinc-500">Change</span>
            <span
              className={`font-semibold ${
                pt.delta > 0
                  ? 'text-emerald-400'
                  : pt.delta < 0
                  ? 'text-rose-400'
                  : 'text-zinc-400'
              }`}
            >
              {pt.delta > 0 ? `+${pt.delta} pts` : pt.delta < 0 ? `${pt.delta} pts` : '0 pts'}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 text-[11px] text-zinc-400 pt-1">
          <span className="font-sans">Keywords</span>
          <span>{pt.keywordMatch}%</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[11px] text-zinc-400">
          <span className="font-sans">Tech Skills</span>
          <span>{pt.technicalSkills}%</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[11px] text-zinc-400">
          <span className="font-sans">Experience</span>
          <span>{pt.workExperience}%</span>
        </div>
      </div>
    </div>
  );
}

export function ScoreHistorySection({
  user,
  authReady,
  onSignIn,
  onSignOut,
  sessions,
  historyLoading,
  historyError,
  currentAnalysis,
  currentResume,
  activeSavedSessionId,
  onSaveSession,
  onLoadSession,
  onDeleteSession,
}: ScoreHistorySectionProps) {
  const defaultLabel = currentResume
    ? currentResume.filename.replace(/\.(pdf|docx)$/i, '')
    : 'Resume Check';

  const [sessionLabel, setSessionLabel] = useState(defaultLabel);
  const [targetRole, setTargetRole] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('overall');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const chartData = useMemo<ChartPoint[]>(() => {
    return sessions.map((session, idx) => {
      const prev = idx > 0 ? sessions[idx - 1] : null;
      const dateObj = new Date(session.createdAtMs);
      const shortDate = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      return {
        index: idx + 1,
        shortLabel: `#${idx + 1} · ${shortDate}`,
        sessionLabel: session.sessionLabel,
        targetRole: session.targetRole,
        resumeFilename: session.resumeFilename,
        dateFormatted: dateObj.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        overallScore: session.overallScore,
        scoreCategory: session.scoreCategory,
        keywordMatch: session.scoreBreakdown?.keywordMatch ?? 0,
        technicalSkills: session.scoreBreakdown?.technicalSkills ?? 0,
        workExperience: session.scoreBreakdown?.workExperience ?? 0,
        delta: prev ? session.overallScore - prev.overallScore : null,
      };
    });
  }, [sessions]);

  const metrics = useMemo(() => {
    if (sessions.length === 0) return null;
    const first = sessions[0].overallScore;
    const latest = sessions[sessions.length - 1].overallScore;
    const best = Math.max(...sessions.map((s) => s.overallScore));
    const netChange = sessions.length > 1 ? latest - first : null;
    return {
      count: sessions.length,
      latest,
      best,
      netChange,
    };
  }, [sessions]);

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveSession || !currentAnalysis) return;
    const cleanLabel = sessionLabel.trim() || defaultLabel;
    setIsSaving(true);
    setSaveError(null);
    setSavedNotice(null);
    try {
      await onSaveSession(cleanLabel, targetRole.trim());
      setSavedNotice('Analysis session saved to your historical tracker.');
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : 'Unable to save analysis session.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await onSignIn();
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : 'Google sign-in could not be completed.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteSession(id);
    } catch {
      // Error surfaced via historyError or boundary
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section
      id="score-history"
      className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-7"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <h2 className="font-display text-lg font-semibold text-zinc-100">
              Saved Sessions &amp; ATS Score History
            </h2>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Save iterations as you tailor your resume and track your ATS score improvements over time.
          </p>
        </div>

        {authReady && (
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 truncate max-w-[180px]">
                  {user.email || user.displayName}
                </span>
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={authBusy}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-semibold text-zinc-100 hover:border-emerald-500/60 hover:bg-zinc-900 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {authBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                ) : (
                  <LogIn className="h-3.5 w-3.5 text-emerald-400" />
                )}
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        )}
      </div>

      {authError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <span>{authError}</span>
        </div>
      )}

      {/* Save Current Analysis Session Form */}
      {currentAnalysis && currentResume && onSaveSession && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/70 p-5">
          {!user ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Save this {currentAnalysis.overallScore}/100 analysis session
                </h3>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Sign in with your Google account to store this analysis and chart your score improvements over time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={authBusy}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {authBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogIn className="h-3.5 w-3.5" />
                )}
                <span>Sign in to Save Session</span>
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSaveSubmit(e)} className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor="session-label-input"
                    className="block text-xs font-semibold text-zinc-300 mb-1.5"
                  >
                    Session Label
                  </label>
                  <input
                    id="session-label-input"
                    type="text"
                    required
                    maxLength={SESSION_LIMITS.maxSessionLabel}
                    value={sessionLabel}
                    onChange={(e) => {
                      setSessionLabel(e.target.value);
                      setSavedNotice(null);
                    }}
                    placeholder="e.g., Resume v2 after keyword tuning"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <label
                    htmlFor="target-role-input"
                    className="block text-xs font-semibold text-zinc-300 mb-1.5"
                  >
                    Target Role / Company (Optional)
                  </label>
                  <input
                    id="target-role-input"
                    type="text"
                    maxLength={SESSION_LIMITS.maxTargetRole}
                    value={targetRole}
                    onChange={(e) => {
                      setTargetRole(e.target.value);
                      setSavedNotice(null);
                    }}
                    placeholder="e.g., Senior Frontend Engineer"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving || Boolean(activeSavedSessionId && savedNotice)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 h-[38px]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : activeSavedSessionId && savedNotice ? (
                    <>
                      <BookmarkCheck className="h-4 w-4" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="h-4 w-4" />
                      <span>Save Session ({currentAnalysis.overallScore}/100)</span>
                    </>
                  )}
                </button>
              </div>

              {savedNotice && (
                <p className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                  <BookmarkCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>{savedNotice}</span>
                </p>
              )}

              {saveError && (
                <p
                  role="alert"
                  className="text-xs font-medium text-rose-400 flex items-center gap-1.5"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{saveError}</span>
                </p>
              )}
            </form>
          )}
        </div>
      )}

      {/* Historical Chart & Saved Sessions Table */}
      {user && (
        <div className="mt-6 space-y-6">
          {historyError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{historyError}</span>
            </div>
          )}

          {historyLoading ? (
            <div className="py-10 flex flex-col items-center justify-center text-zinc-400 text-sm">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-400 mb-2" />
              <span>Loading your saved ATS score history...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 p-8 text-center">
              <p className="text-sm font-medium text-zinc-200">
                No saved analysis sessions yet
              </p>
              <p className="mt-1 text-xs text-zinc-400 max-w-md mx-auto">
                {currentAnalysis
                  ? 'Use the form above to save this session. Once you save two or more resume iterations, your ATS score improvement trend will chart here.'
                  : 'Run an ATS resume analysis and save the session to start tracking your score improvements over time.'}
              </p>
            </div>
          ) : (
            <>
              {/* 4-Column Summary KPI Strip */}
              {metrics && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                    <span className="text-xs font-medium text-zinc-400">Saved Sessions</span>
                    <p className="mt-1 font-mono text-2xl font-bold text-zinc-50 tabular-nums">
                      {metrics.count}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                    <span className="text-xs font-medium text-zinc-400">Latest Score</span>
                    <p className="mt-1 font-mono text-2xl font-bold text-zinc-50 tabular-nums">
                      {metrics.latest}
                      <span className="text-xs font-normal text-zinc-500">/100</span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                    <span className="text-xs font-medium text-zinc-400">Best Score</span>
                    <p className="mt-1 font-mono text-2xl font-bold text-sky-400 tabular-nums">
                      {metrics.best}
                      <span className="text-xs font-normal text-zinc-500">/100</span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                    <span className="text-xs font-medium text-zinc-400">Net Improvement</span>
                    <p
                      className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                        metrics.netChange === null
                          ? 'text-zinc-500'
                          : metrics.netChange > 0
                          ? 'text-emerald-400'
                          : metrics.netChange < 0
                          ? 'text-rose-400'
                          : 'text-zinc-300'
                      }`}
                    >
                      {metrics.netChange === null
                        ? '—'
                        : metrics.netChange > 0
                        ? `+${metrics.netChange}`
                        : `${metrics.netChange}`}
                      {metrics.netChange !== null && (
                        <span className="text-xs font-normal text-zinc-500 ml-1">pts</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Recharts Historical Trend Chart */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">
                      ATS Score Progression Over Time
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Chronological progression across your saved resume checks
                    </p>
                  </div>

                  <div
                    role="tablist"
                    aria-label="Chart metric mode"
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1 self-start"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={chartMode === 'overall'}
                      onClick={() => setChartMode('overall')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        chartMode === 'overall'
                          ? 'bg-emerald-500 text-zinc-950 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      Overall Score
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={chartMode === 'breakdown'}
                      onClick={() => setChartMode('breakdown')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        chartMode === 'breakdown'
                          ? 'bg-emerald-500 text-zinc-950 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      Key Sub-Scores
                    </button>
                  </div>
                </div>

                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartMode === 'overall' ? (
                      <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient id="atsScoreGradientDark" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.32} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                        <XAxis
                          dataKey="shortLabel"
                          tick={{ fontSize: 11, fill: '#A1A1AA' }}
                          axisLine={{ stroke: '#3F3F46' }}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: '#A1A1AA' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="overallScore"
                          name="Overall ATS Score"
                          stroke="#10B981"
                          strokeWidth={2.5}
                          fill="url(#atsScoreGradientDark)"
                          dot={{ r: 4, fill: '#10B981', stroke: '#09090B', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#34D399', stroke: '#064E3B', strokeWidth: 3 }}
                        />
                      </AreaChart>
                    ) : (
                      <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                        <XAxis
                          dataKey="shortLabel"
                          tick={{ fontSize: 11, fill: '#A1A1AA' }}
                          axisLine={{ stroke: '#3F3F46' }}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: '#A1A1AA' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: '#D4D4D8' }} />
                        <Line
                          type="monotone"
                          dataKey="overallScore"
                          name="Overall Score"
                          stroke="#10B981"
                          strokeWidth={2.5}
                          dot={{ r: 3.5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="keywordMatch"
                          name="Keyword Match (25%)"
                          stroke="#38BDF8"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="technicalSkills"
                          name="Technical Skills (20%)"
                          stroke="#2DD4BF"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="workExperience"
                          name="Work Experience (20%)"
                          stroke="#FBBF24"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Saved Sessions Table */}
              <div className="overflow-hidden rounded-xl border border-zinc-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-400">
                        <th className="py-3 px-4">Session</th>
                        <th className="py-3 px-4">Resume File</th>
                        <th className="py-3 px-4">Saved Date</th>
                        <th className="py-3 px-4 text-right">Score</th>
                        <th className="py-3 px-4 text-right">Change</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80 text-sm bg-zinc-900/50">
                      {[...sessions].reverse().map((session) => {
                        const originalIdx = sessions.findIndex((s) => s.id === session.id);
                        const prev = originalIdx > 0 ? sessions[originalIdx - 1] : null;
                        const delta = prev ? session.overallScore - prev.overallScore : null;
                        const isActive = activeSavedSessionId === session.id;

                        return (
                          <tr
                            key={session.id}
                            className={`transition-colors ${
                              isActive ? 'bg-emerald-500/10' : 'hover:bg-zinc-800/40'
                            }`}
                          >
                            <td className="py-3 px-4">
                              <div className="font-medium text-zinc-100">
                                {session.sessionLabel}
                              </div>
                              {session.targetRole && (
                                <div className="text-xs text-zinc-400">{session.targetRole}</div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-zinc-400 max-w-[180px] truncate">
                              {session.resumeFilename}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                              {new Date(session.createdAtMs).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-100 tabular-nums whitespace-nowrap">
                              {session.overallScore}/100
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                              {delta === null ? (
                                <span className="text-zinc-500">Baseline</span>
                              ) : delta > 0 ? (
                                <span className="font-semibold text-emerald-400">+{delta}</span>
                              ) : delta < 0 ? (
                                <span className="font-semibold text-rose-400">{delta}</span>
                              ) : (
                                <span className="text-zinc-400">0</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onLoadSession(session)}
                                  className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>{isActive ? 'Viewing' : 'Open'}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={deletingId === session.id}
                                  onClick={() => void handleDelete(session.id)}
                                  aria-label={`Delete saved session ${session.sessionLabel}`}
                                  className="inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-950 p-1.5 text-zinc-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-50"
                                >
                                  {deletingId === session.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
