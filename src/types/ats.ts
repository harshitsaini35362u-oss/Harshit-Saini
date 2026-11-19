export type ScoreCategory = 'Poor' | 'Average' | 'Good' | 'Excellent';

export interface ScoreBreakdown {
  keywordMatch: number;
  technicalSkills: number;
  workExperience: number;
  jobTitleRelevance: number;
  educationCertifications: number;
  softSkills: number;
  formattingReadability: number;
}

export interface ImprovedBulletPoint {
  original: string;
  improved: string;
  reason: string;
}

export interface CategorizedRecommendation {
  area:
    | 'Professional Summary'
    | 'Work Experience'
    | 'Skills Section'
    | 'Resume Formatting'
    | 'Keyword Optimization'
    | 'Achievement Statements'
    | 'Action Verbs';
  priority: 'High' | 'Medium' | 'Low';
  advice: string;
}

export interface ATSAnalysisResult {
  overallScore: number;
  scoreCategory: ScoreCategory;
  scoreBreakdown: ScoreBreakdown;
  matchedKeywords: string[];
  missingKeywords: string[];
  missingTechnicalSkills: string[];
  industryKeywords: string[];
  suggestedKeywords: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  categorizedRecommendations: CategorizedRecommendation[];
  summaryFeedback: string;
  improvedProfessionalSummary: string;
  improvedBulletPoints: ImprovedBulletPoint[];
  optimizationChecklist: string[];
}

export interface ExtractedResume {
  filename: string;
  fileSize: number;
  fileType: 'pdf' | 'docx';
  text: string;
  wordCount: number;
  pageCount?: number;
}

export interface ResumeImproverResult {
  improvedSummary: string;
  rewrittenBullets: ImprovedBulletPoint[];
  optimizedSkillsSection: string;
  tailoringNotes: string;
}

export interface SavedAnalysisSession {
  id: string;
  ownerId: string;
  sessionLabel: string;
  targetRole: string;
  resumeFilename: string;
  wordCount: number;
  overallScore: number;
  scoreCategory: ScoreCategory;
  scoreBreakdown: ScoreBreakdown;
  matchedKeywords: string[];
  missingKeywords: string[];
  missingTechnicalSkills: string[];
  suggestedKeywords: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  summaryFeedback: string;
  improvedProfessionalSummary: string;
  optimizationChecklist: string[];
  jobDescriptionSnippet: string;
  createdAtMs: number;
  updatedAtMs: number;
}

