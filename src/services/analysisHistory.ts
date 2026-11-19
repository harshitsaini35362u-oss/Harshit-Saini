import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  ATSAnalysisResult,
  ExtractedResume,
  SavedAnalysisSession,
  ScoreBreakdown,
  ScoreCategory,
} from '../types/ats';

// Blueprint-synchronized volumetric bounds
export const SESSION_LIMITS = {
  maxSessionLabel: 160,
  maxTargetRole: 160,
  maxFilename: 255,
  maxSummaryFeedback: 2000,
  maxImprovedSummary: 2500,
  maxJdSnippet: 1500,
  maxKeywords: 60,
  maxSkills: 40,
  maxList: 20,
} as const;

function truncateString(value: string, maxLen: number): string {
  const trimmed = value.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function clampInt(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function boundStringList(items: string[], maxItems: number, maxItemLen = 180): string[] {
  return items
    .map((item) => truncateString(String(item), maxItemLen))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

function generateDocumentId(): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `ats_${randomPart}`.slice(0, 64);
}

function timestampToMs(ts: unknown): number {
  if (ts instanceof Timestamp) {
    return ts.toMillis();
  }
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'toMillis' in ts &&
    typeof (ts as { toMillis: unknown }).toMillis === 'function'
  ) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export async function saveAnalysisSession(params: {
  ownerId: string;
  sessionLabel: string;
  targetRole: string;
  resume: ExtractedResume;
  jobDescription: string;
  analysis: ATSAnalysisResult;
}): Promise<string> {
  const { ownerId, sessionLabel, targetRole, resume, jobDescription, analysis } = params;
  const docId = generateDocumentId();
  const docPath = `analyses/${docId}`;

  const cleanLabel = truncateString(
    sessionLabel || resume.filename || 'ATS Resume Check',
    SESSION_LIMITS.maxSessionLabel
  );
  const cleanRole = truncateString(targetRole, SESSION_LIMITS.maxTargetRole);
  const cleanFilename = truncateString(
    resume.filename || 'resume.pdf',
    SESSION_LIMITS.maxFilename
  );

  const scoreBreakdown: ScoreBreakdown = {
    keywordMatch: clampInt(analysis.scoreBreakdown.keywordMatch),
    technicalSkills: clampInt(analysis.scoreBreakdown.technicalSkills),
    workExperience: clampInt(analysis.scoreBreakdown.workExperience),
    jobTitleRelevance: clampInt(analysis.scoreBreakdown.jobTitleRelevance),
    educationCertifications: clampInt(analysis.scoreBreakdown.educationCertifications),
    softSkills: clampInt(analysis.scoreBreakdown.softSkills),
    formattingReadability: clampInt(analysis.scoreBreakdown.formattingReadability),
  };

  const payload = {
    ownerId,
    sessionLabel: cleanLabel,
    targetRole: cleanRole,
    resumeFilename: cleanFilename,
    wordCount: clampInt(resume.wordCount, 0, 100000),
    overallScore: clampInt(analysis.overallScore),
    scoreCategory: analysis.scoreCategory,
    scoreBreakdown,
    matchedKeywords: boundStringList(analysis.matchedKeywords, SESSION_LIMITS.maxKeywords, 100),
    missingKeywords: boundStringList(analysis.missingKeywords, SESSION_LIMITS.maxKeywords, 100),
    missingTechnicalSkills: boundStringList(
      analysis.missingTechnicalSkills,
      SESSION_LIMITS.maxSkills,
      100
    ),
    suggestedKeywords: boundStringList(
      analysis.suggestedKeywords,
      SESSION_LIMITS.maxSkills,
      100
    ),
    strengths: boundStringList(analysis.strengths, SESSION_LIMITS.maxList, 280),
    weaknesses: boundStringList(analysis.weaknesses, SESSION_LIMITS.maxList, 280),
    recommendations: boundStringList(analysis.recommendations, SESSION_LIMITS.maxList, 320),
    summaryFeedback: truncateString(
      analysis.summaryFeedback,
      SESSION_LIMITS.maxSummaryFeedback
    ),
    improvedProfessionalSummary: truncateString(
      analysis.improvedProfessionalSummary,
      SESSION_LIMITS.maxImprovedSummary
    ),
    optimizationChecklist: boundStringList(
      analysis.optimizationChecklist,
      SESSION_LIMITS.maxList,
      240
    ),
    jobDescriptionSnippet: truncateString(
      jobDescription,
      SESSION_LIMITS.maxJdSnippet
    ),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'analyses', docId), payload);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export function subscribeToUserAnalyses(
  userId: string,
  onData: (sessions: SavedAnalysisSession[]) => void,
  onError: (err: Error) => void
): () => void {
  const analysesQuery = query(
    collection(db, 'analyses'),
    where('ownerId', '==', userId)
  );

  return onSnapshot(
    analysesQuery,
    (snapshot) => {
      const sessions: SavedAnalysisSession[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: String(d.ownerId ?? ''),
          sessionLabel: String(d.sessionLabel ?? 'Untitled Session'),
          targetRole: String(d.targetRole ?? ''),
          resumeFilename: String(d.resumeFilename ?? 'resume'),
          wordCount: Number(d.wordCount ?? 0),
          overallScore: Number(d.overallScore ?? 0),
          scoreCategory: (d.scoreCategory as ScoreCategory) || 'Average',
          scoreBreakdown: d.scoreBreakdown as ScoreBreakdown,
          matchedKeywords: Array.isArray(d.matchedKeywords) ? (d.matchedKeywords as string[]) : [],
          missingKeywords: Array.isArray(d.missingKeywords) ? (d.missingKeywords as string[]) : [],
          missingTechnicalSkills: Array.isArray(d.missingTechnicalSkills)
            ? (d.missingTechnicalSkills as string[])
            : [],
          suggestedKeywords: Array.isArray(d.suggestedKeywords)
            ? (d.suggestedKeywords as string[])
            : [],
          strengths: Array.isArray(d.strengths) ? (d.strengths as string[]) : [],
          weaknesses: Array.isArray(d.weaknesses) ? (d.weaknesses as string[]) : [],
          recommendations: Array.isArray(d.recommendations)
            ? (d.recommendations as string[])
            : [],
          summaryFeedback: String(d.summaryFeedback ?? ''),
          improvedProfessionalSummary: String(d.improvedProfessionalSummary ?? ''),
          optimizationChecklist: Array.isArray(d.optimizationChecklist)
            ? (d.optimizationChecklist as string[])
            : [],
          jobDescriptionSnippet: String(d.jobDescriptionSnippet ?? ''),
          createdAtMs: timestampToMs(d.createdAt),
          updatedAtMs: timestampToMs(d.updatedAt),
        };
      });

      sessions.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(sessions);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'analyses');
      } catch (wrappedErr) {
        onError(
          wrappedErr instanceof Error
            ? wrappedErr
            : new Error('Unable to load saved analysis history.')
        );
      }
    }
  );
}

export async function deleteAnalysisSession(analysisId: string): Promise<void> {
  const docPath = `analyses/${analysisId}`;
  try {
    await deleteDoc(doc(db, 'analyses', analysisId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
