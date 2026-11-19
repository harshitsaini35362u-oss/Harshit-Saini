import { onAuthStateChanged, type User } from 'firebase/auth';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { LandingSections } from './components/LandingSections';
import { Navbar } from './components/Navbar';
import { ScoreHistorySection } from './components/ScoreHistorySection';
import { UploadWorkspace } from './components/UploadWorkspace';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import {
  deleteAnalysisSession,
  saveAnalysisSession,
  subscribeToUserAnalyses,
} from './services/analysisHistory';
import type {
  ATSAnalysisResult,
  ExtractedResume,
  SavedAnalysisSession,
} from './types/ats';

const ANALYSIS_STAGES = [
  'Preparing resume content & job requirements...',
  'Evaluating 7 weighted ATS compatibility criteria...',
  'Mapping matched and missing keywords...',
  'Generating factual bullet rewrites and optimization checklist...',
];

export default function App() {
  const [extractedResume, setExtractedResume] = useState<ExtractedResume | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [analysisResult, setAnalysisResult] = useState<ATSAnalysisResult | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<Date | null>(null);
  const [activeSavedSessionId, setActiveSavedSessionId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedAnalysisSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setSavedSessions([]);
      setHistoryLoading(false);
      setHistoryError(null);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);

    const unsubscribe = subscribeToUserAnalyses(
      user.uid,
      (sessions) => {
        setSavedSessions(sessions);
        setHistoryLoading(false);
      },
      (err) => {
        setHistoryError(err.message);
        setHistoryLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  useEffect(() => {
    if (!isAnalyzing) {
      setStageIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setStageIndex((prev) => (prev < ANALYSIS_STAGES.length - 1 ? prev + 1 : prev));
    }, 2400);
    return () => clearInterval(timer);
  }, [isAnalyzing]);

  const handleAnalyze = async () => {
    if (!extractedResume || jobDescription.trim().length < 30) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: extractedResume.text,
          jobDescription: jobDescription.trim(),
          fileName: extractedResume.filename,
        }),
      });

      const data = (await response.json()) as ATSAnalysisResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'ATS analysis failed. Please try again.');
      }

      setAnalysisResult(data);
      setAnalyzedAt(new Date());
      setActiveSavedSessionId(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Unable to complete ATS analysis.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveSession = async (label: string, targetRole: string) => {
    if (!user || !analysisResult || !extractedResume) {
      throw new Error('Please sign in and run an analysis before saving.');
    }
    const docId = await saveAnalysisSession({
      ownerId: user.uid,
      sessionLabel: label,
      targetRole,
      resume: extractedResume,
      jobDescription,
      analysis: analysisResult,
    });
    setActiveSavedSessionId(docId);
  };

  const handleLoadSession = (session: SavedAnalysisSession) => {
    const reconstructedAnalysis: ATSAnalysisResult = {
      overallScore: session.overallScore,
      scoreCategory: session.scoreCategory,
      scoreBreakdown: session.scoreBreakdown,
      matchedKeywords: session.matchedKeywords,
      missingKeywords: session.missingKeywords,
      missingTechnicalSkills: session.missingTechnicalSkills,
      industryKeywords: [],
      suggestedKeywords: session.suggestedKeywords,
      strengths: session.strengths,
      weaknesses: session.weaknesses,
      recommendations: session.recommendations,
      categorizedRecommendations: [],
      summaryFeedback: session.summaryFeedback,
      improvedProfessionalSummary: session.improvedProfessionalSummary,
      improvedBulletPoints: [],
      optimizationChecklist: session.optimizationChecklist,
    };

    const reconstructedResume: ExtractedResume = {
      filename: session.resumeFilename,
      fileSize: 0,
      fileType: session.resumeFilename.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf',
      text: '',
      wordCount: session.wordCount,
    };

    setExtractedResume(reconstructedResume);
    setJobDescription(session.jobDescriptionSnippet);
    setAnalysisResult(reconstructedAnalysis);
    setAnalyzedAt(new Date(session.createdAtMs));
    setActiveSavedSessionId(session.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteAnalysisSession(sessionId);
    if (activeSavedSessionId === sessionId) {
      setActiveSavedSessionId(null);
    }
  };

  const handleResetToUpload = () => {
    setAnalysisResult(null);
    setAnalyzedAt(null);
    setActiveSavedSessionId(null);
    setAnalysisError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToAnalyzer = () => {
    if (analysisResult) {
      handleResetToUpload();
      return;
    }
    const el = document.getElementById('analyzer');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <Navbar
        mode={analysisResult ? 'analysis' : 'landing'}
        onNavigateHome={handleResetToUpload}
        onPrimaryAction={scrollToAnalyzer}
      />

      {analysisResult && extractedResume && analyzedAt ? (
        <AnalysisDashboard
          analysis={analysisResult}
          resume={extractedResume}
          jobDescription={jobDescription}
          analyzedAt={analyzedAt}
          onAnalyzeAnother={handleResetToUpload}
          user={user}
          authReady={authReady}
          onSignIn={async () => {
            await signInWithGoogle();
          }}
          onSignOut={signOutUser}
          sessions={savedSessions}
          historyLoading={historyLoading}
          historyError={historyError}
          activeSavedSessionId={activeSavedSessionId}
          onSaveSession={handleSaveSession}
          onLoadSession={handleLoadSession}
          onDeleteSession={handleDeleteSession}
        />
      ) : (
        <main className="flex-1">
          {/* Asymmetric Split Hero + Live Studio Workbench */}
          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:pt-14 sm:pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
              {/* Left 5 Columns: Editorial Typography & Value Specs */}
              <div className="lg:col-span-5 lg:pt-4">
                <p className="text-xs font-semibold tracking-wide text-emerald-400">
                  AI-Powered ATS Diagnostics · PDF &amp; DOCX
                </p>
                <h1
                  className="mt-3 font-display font-extrabold tracking-tight text-zinc-50 leading-[1.08]"
                  style={{
                    fontSize: 'clamp(2.15rem, 3.8vw, 3.25rem)',
                    textWrap: 'balance',
                  }}
                >
                  Know Your Resume&apos;s ATS Score Before You Apply
                </h1>
                <p className="mt-5 text-base leading-relaxed text-zinc-400">
                  Compare your resume directly against a target job posting. Inspect weighted keyword alignment, surface skill gaps honestly, generate factual bullet rewrites, and track your score progression over time.
                </p>

                <ul className="mt-8 space-y-3 border-t border-zinc-800 pt-6 text-sm text-zinc-300">
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                    <span>7-factor weighted ATS compatibility model (0–100)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                    <span>Zero fabrication—only experience-backed keyword suggestions</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                    <span>Downloadable multi-page PDF report &amp; Recharts history</span>
                  </li>
                </ul>

                <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                  <a
                    href="#scoring-model"
                    className="font-semibold text-zinc-200 hover:text-emerald-400 underline underline-offset-4 decoration-zinc-700 transition-colors"
                  >
                    Inspect scoring weights
                  </a>
                  <span aria-hidden="true">·</span>
                  <a
                    href="#score-history"
                    className="font-semibold text-zinc-200 hover:text-emerald-400 underline underline-offset-4 decoration-zinc-700 transition-colors"
                  >
                    View saved score history
                  </a>
                </div>
              </div>

              {/* Right 7 Columns: Stacked Studio Workbench */}
              <div className="lg:col-span-7">
                <UploadWorkspace
                  extractedResume={extractedResume}
                  jobDescription={jobDescription}
                  onJobDescriptionChange={setJobDescription}
                  onResumeExtracted={setExtractedResume}
                  onAnalyze={() => void handleAnalyze()}
                  isAnalyzing={isAnalyzing}
                  analysisStage={ANALYSIS_STAGES[stageIndex]}
                  analysisError={analysisError}
                />
              </div>
            </div>
          </section>

          {/* Saved History & Recharts Score Trend */}
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
            <ScoreHistorySection
              user={user}
              authReady={authReady}
              onSignIn={async () => {
                await signInWithGoogle();
              }}
              onSignOut={signOutUser}
              sessions={savedSessions}
              historyLoading={historyLoading}
              historyError={historyError}
              activeSavedSessionId={activeSavedSessionId}
              onLoadSession={handleLoadSession}
              onDeleteSession={handleDeleteSession}
            />
          </div>

          <LandingSections />
        </main>
      )}

      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="font-display font-semibold text-zinc-200">
            ATS Resume Analyzer
          </div>
          <p className="text-center sm:text-right">
            Scores are AI-generated estimates for preparation purposes and do not guarantee employer ATS outcomes.
          </p>
        </div>
      </footer>
    </div>
  );
}
