import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  ATSAnalysisResult,
  CategorizedRecommendation,
  ImprovedBulletPoint,
  ResumeImproverResult,
  ScoreBreakdown,
  ScoreCategory,
} from './src/types/ats.ts';

const require = createRequire(import.meta.url);
const pdfWorkerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(pdfWorkerPath).href;

const PORT = Number(process.env.PORT) || 3000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new AppError(
      'Gemini API key is not configured. Please add GEMINI_API_KEY in the Settings > Secrets panel.',
      503
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const errMsg = error instanceof Error ? error.message : String(error);
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: unknown }).status)
          : undefined;
      const isTransient =
        status === 429 ||
        status === 503 ||
        status === 500 ||
        /RESOURCE_EXHAUSTED|UNAVAILABLE|ECONNRESET|ETIMEDOUT/i.test(errMsg);

      if (!isTransient || attempt === maxRetries) {
        throw error;
      }
      const delayMs = 800 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function mapGeminiError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/API_KEY_INVALID|PERMISSION_DENIED|403|401/i.test(message)) {
    return new AppError(
      'Gemini API authentication failed. Please verify your API key in Settings > Secrets.',
      403
    );
  }
  if (/RESOURCE_EXHAUSTED|429/i.test(message)) {
    return new AppError(
      'The AI service is temporarily rate-limited. Please wait a moment and try again.',
      429
    );
  }
  if (/NOT_FOUND|404/i.test(message)) {
    return new AppError(
      'Configured AI model was unavailable. Please try again or contact support.',
      502
    );
  }
  return new AppError(`AI analysis failed: ${message}`, 502);
}

function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    let currentLine = '';
    let lastY: number | null = null;
    const lines: string[] = [];

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const textItem = item as { str: string; transform?: number[]; hasEOL?: boolean };
      const y = Array.isArray(textItem.transform) ? Math.round(textItem.transform[5]) : null;

      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = textItem.str;
      } else {
        if (currentLine && textItem.str && !currentLine.endsWith(' ') && !textItem.str.startsWith(' ')) {
          currentLine += ' ';
        }
        currentLine += textItem.str;
      }

      if (textItem.hasEOL) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = '';
        lastY = null;
      } else if (y !== null) {
        lastY = y;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }
    pageTexts.push(lines.join('\n'));
  }

  await pdf.cleanup();
  return {
    text: normalizeExtractedText(pageTexts.join('\n\n')),
    pageCount,
  };
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return normalizeExtractedText(result.value ?? '');
}

function clampScore(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function computeWeightedOverallScore(breakdown: ScoreBreakdown): number {
  const weighted =
    breakdown.keywordMatch * 0.25 +
    breakdown.technicalSkills * 0.2 +
    breakdown.workExperience * 0.2 +
    breakdown.jobTitleRelevance * 0.1 +
    breakdown.educationCertifications * 0.1 +
    breakdown.softSkills * 0.05 +
    breakdown.formattingReadability * 0.1;
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

function deriveScoreCategory(score: number): ScoreCategory {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Average';
  return 'Poor';
}

function sanitizeStringArray(arr: unknown, maxItems = 40): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(trimmed);
    if (cleaned.length >= maxItems) break;
  }
  return cleaned;
}

function sanitizeBullets(arr: unknown): ImprovedBulletPoint[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null
    )
    .map((item) => ({
      original: typeof item.original === 'string' ? item.original.trim() : '',
      improved: typeof item.improved === 'string' ? item.improved.trim() : '',
      reason: typeof item.reason === 'string' ? item.reason.trim() : '',
    }))
    .filter((b) => b.original.length > 0 && b.improved.length > 0);
}

const VALID_AREAS = new Set([
  'Professional Summary',
  'Work Experience',
  'Skills Section',
  'Resume Formatting',
  'Keyword Optimization',
  'Achievement Statements',
  'Action Verbs',
]);

function sanitizeCategorizedRecommendations(arr: unknown): CategorizedRecommendation[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null
    )
    .map((item) => {
      const areaRaw = typeof item.area === 'string' ? item.area.trim() : 'Work Experience';
      const area = (
        VALID_AREAS.has(areaRaw) ? areaRaw : 'Work Experience'
      ) as CategorizedRecommendation['area'];
      const priorityRaw = typeof item.priority === 'string' ? item.priority.trim() : 'Medium';
      const priority = (
        priorityRaw === 'High' || priorityRaw === 'Medium' || priorityRaw === 'Low'
          ? priorityRaw
          : 'Medium'
      ) as CategorizedRecommendation['priority'];
      const advice = typeof item.advice === 'string' ? item.advice.trim() : '';
      return { area, priority, advice };
    })
    .filter((r) => r.advice.length > 0);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

const app = express();
app.use(express.json({ limit: '4mb' }));

app.post(
  '/api/extract-resume',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: 'File size exceeds the 10 MB limit. Please upload a smaller PDF or DOCX file.',
          });
          return;
        }
        res.status(400).json({ error: `Upload error: ${err.message}` });
        return;
      }
      if (err) {
        res.status(400).json({ error: 'Unable to process uploaded file.' });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No resume file was uploaded.' });
        return;
      }

      const ext = path.extname(file.originalname).toLowerCase();
      const mime = file.mimetype.toLowerCase();

      if (ext === '.doc') {
        res.status(400).json({
          error:
            'Legacy .doc files are not supported. Please export or save your resume as .pdf or .docx.',
        });
        return;
      }

      const isPdf = ext === '.pdf' || mime === 'application/pdf';
      const isDocx =
        ext === '.docx' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      if (!isPdf && !isDocx) {
        res.status(400).json({
          error: 'Unsupported file format. Please upload a .pdf or .docx resume.',
        });
        return;
      }

      let extractedText = '';
      let pageCount: number | undefined;

      if (isPdf) {
        const pdfResult = await extractPdfText(file.buffer);
        extractedText = pdfResult.text;
        pageCount = pdfResult.pageCount;
      } else {
        extractedText = await extractDocxText(file.buffer);
      }

      const wordCount = extractedText
        ? extractedText.split(/\s+/).filter(Boolean).length
        : 0;

      if (extractedText.length < 40 || wordCount < 8) {
        res.status(422).json({
          error:
            'No readable text could be extracted from this file. If your PDF is a scanned image, please export a text-based PDF or DOCX file.',
        });
        return;
      }

      res.json({
        filename: file.originalname,
        fileSize: file.size,
        fileType: isPdf ? 'pdf' : 'docx',
        text: extractedText,
        wordCount,
        pageCount,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown parsing error';
      res.status(422).json({
        error: `Failed to read resume file (${msg}). Please verify the file is not corrupted or password-protected.`,
      });
    }
  }
);

app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { resumeText, jobDescription, fileName } = req.body as {
      resumeText?: unknown;
      jobDescription?: unknown;
      fileName?: unknown;
    };

    if (typeof resumeText !== 'string' || resumeText.trim().length < 40) {
      res.status(400).json({
        error: 'Resume content is missing or too short. Please upload a valid resume.',
      });
      return;
    }
    if (typeof jobDescription !== 'string' || jobDescription.trim().length < 30) {
      res.status(400).json({
        error: 'Job description is missing or too short. Please paste the full job description.',
      });
      return;
    }

    const trimmedResume = resumeText.trim().slice(0, 32000);
    const trimmedJd = jobDescription.trim().slice(0, 18000);
    const safeFileName = typeof fileName === 'string' ? fileName : 'Uploaded Resume';

    const ai = getGeminiClient();

    const systemInstruction = `You are a senior technical recruiter, Applicant Tracking System (ATS) specialist, and career coach.
Evaluate the provided resume strictly and objectively against the provided job description.

EVALUATION PARAMETERS:
1. Keyword Optimization & Exact/Semantic Term Match
2. Technical Skills Match (languages, frameworks, platforms, tools, methodologies)
3. Soft Skills Match (leadership, communication, cross-functional collaboration, problem-solving)
4. Work Experience Relevance (scope, seniority, domain alignment, measurable impact)
5. Educational Qualification & Relevant Certifications Match
6. Job Title & Role Relevance
7. Resume Formatting, Structure, Readability, Action Verbs, and Impact Statements

SCORING MODEL (each category scored 0-100 integer):
- keywordMatch (weight 25%)
- technicalSkills (weight 20%)
- workExperience (weight 20%)
- jobTitleRelevance (weight 10%)
- educationCertifications (weight 10%)
- softSkills (weight 5%)
- formattingReadability (weight 10%)

CRITICAL FACTUALITY & HONESTY RULES:
- Base every score, keyword match, weakness, and suggestion strictly on evidence present in the resume text and job description.
- NEVER fabricate or suggest adding skills, tools, job titles, degrees, or certifications that the candidate does not actually possess.
- In "suggestedKeywords", ONLY suggest keywords or industry phrasing that the candidate's existing resume evidence actually supports (for example, spelling out acronyms or adopting standard JD terminology for work they clearly already performed). Put genuinely missing requirements into "missingKeywords" and "missingTechnicalSkills" as honest skill gaps.
- In "improvedBulletPoints", quote actual bullet points or sentences from the resume in "original" and rewrite them in "improved" using stronger action verbs, clearer structure, and truthful ATS phrasing—never invent fake metrics or fabricated outcomes. If a bullet lacks numbers, keep it factual or indicate where the candidate could add their own real metric using "[X%]" or "[N]".
- Keep "categorizedRecommendations" covering the key areas: Professional Summary, Work Experience, Skills Section, Resume Formatting, Keyword Optimization, Achievement Statements, and Action Verbs.`;

    const prompt = `Analyze the following resume (${safeFileName}) against the target job description and return structured JSON.

=== RESUME TEXT ===
${trimmedResume}

=== JOB DESCRIPTION ===
${trimmedJd}`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallScore: {
                type: Type.INTEGER,
                description: 'Weighted overall ATS compatibility score from 0 to 100.',
              },
              scoreCategory: {
                type: Type.STRING,
                description: 'One of: Poor, Average, Good, Excellent.',
              },
              scoreBreakdown: {
                type: Type.OBJECT,
                properties: {
                  keywordMatch: { type: Type.INTEGER },
                  technicalSkills: { type: Type.INTEGER },
                  workExperience: { type: Type.INTEGER },
                  jobTitleRelevance: { type: Type.INTEGER },
                  educationCertifications: { type: Type.INTEGER },
                  softSkills: { type: Type.INTEGER },
                  formattingReadability: { type: Type.INTEGER },
                },
                required: [
                  'keywordMatch',
                  'technicalSkills',
                  'workExperience',
                  'jobTitleRelevance',
                  'educationCertifications',
                  'softSkills',
                  'formattingReadability',
                ],
              },
              matchedKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Keywords and skills from the job description found in the resume.',
              },
              missingKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Important keywords from the job description absent from the resume.',
              },
              missingTechnicalSkills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Critical technical skills, tools, or platforms required in the JD that are missing.',
              },
              industryKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Relevant domain and industry-specific terminology present in the JD.',
              },
              suggestedKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'Keywords the candidate can naturally incorporate because their resume shows supporting experience.',
              },
              strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              weaknesses: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              categorizedRecommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    area: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    advice: { type: Type.STRING },
                  },
                  required: ['area', 'priority', 'advice'],
                },
              },
              summaryFeedback: { type: Type.STRING },
              improvedProfessionalSummary: { type: Type.STRING },
              improvedBulletPoints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original: { type: Type.STRING },
                    improved: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['original', 'improved', 'reason'],
                },
              },
              optimizationChecklist: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'overallScore',
              'scoreCategory',
              'scoreBreakdown',
              'matchedKeywords',
              'missingKeywords',
              'missingTechnicalSkills',
              'industryKeywords',
              'suggestedKeywords',
              'strengths',
              'weaknesses',
              'recommendations',
              'categorizedRecommendations',
              'summaryFeedback',
              'improvedProfessionalSummary',
              'improvedBulletPoints',
              'optimizationChecklist',
            ],
          },
        },
      })
    );

    const rawJson = (response.text ?? '').trim();
    if (!rawJson) {
      throw new AppError('Gemini returned an empty response. Please try again.', 502);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawJson) as Record<string, unknown>;
    } catch {
      throw new AppError('Unable to parse structured ATS analysis from AI response.', 502);
    }

    const rawBreakdown = (parsed.scoreBreakdown ?? {}) as Record<string, unknown>;
    const scoreBreakdown: ScoreBreakdown = {
      keywordMatch: clampScore(rawBreakdown.keywordMatch),
      technicalSkills: clampScore(rawBreakdown.technicalSkills),
      workExperience: clampScore(rawBreakdown.workExperience),
      jobTitleRelevance: clampScore(rawBreakdown.jobTitleRelevance),
      educationCertifications: clampScore(rawBreakdown.educationCertifications),
      softSkills: clampScore(rawBreakdown.softSkills),
      formattingReadability: clampScore(rawBreakdown.formattingReadability),
    };

    const overallScore = computeWeightedOverallScore(scoreBreakdown);
    const scoreCategory = deriveScoreCategory(overallScore);

    const result: ATSAnalysisResult = {
      overallScore,
      scoreCategory,
      scoreBreakdown,
      matchedKeywords: sanitizeStringArray(parsed.matchedKeywords),
      missingKeywords: sanitizeStringArray(parsed.missingKeywords),
      missingTechnicalSkills: sanitizeStringArray(parsed.missingTechnicalSkills),
      industryKeywords: sanitizeStringArray(parsed.industryKeywords),
      suggestedKeywords: sanitizeStringArray(parsed.suggestedKeywords),
      strengths: sanitizeStringArray(parsed.strengths, 12),
      weaknesses: sanitizeStringArray(parsed.weaknesses, 12),
      recommendations: sanitizeStringArray(parsed.recommendations, 15),
      categorizedRecommendations: sanitizeCategorizedRecommendations(
        parsed.categorizedRecommendations
      ),
      summaryFeedback:
        typeof parsed.summaryFeedback === 'string' ? parsed.summaryFeedback.trim() : '',
      improvedProfessionalSummary:
        typeof parsed.improvedProfessionalSummary === 'string'
          ? parsed.improvedProfessionalSummary.trim()
          : '',
      improvedBulletPoints: sanitizeBullets(parsed.improvedBulletPoints),
      optimizationChecklist: sanitizeStringArray(parsed.optimizationChecklist, 15),
    };

    res.json(result);
  } catch (error: unknown) {
    const appErr = mapGeminiError(error);
    res.status(appErr.statusCode).json({ error: appErr.message });
  }
});

app.post('/api/improve-resume', async (req: Request, res: Response) => {
  try {
    const { resumeText, jobDescription, suggestedKeywords } = req.body as {
      resumeText?: unknown;
      jobDescription?: unknown;
      suggestedKeywords?: unknown;
    };

    if (typeof resumeText !== 'string' || resumeText.trim().length < 40) {
      res.status(400).json({ error: 'Resume text is required to generate improvements.' });
      return;
    }
    if (typeof jobDescription !== 'string' || jobDescription.trim().length < 30) {
      res.status(400).json({ error: 'Job description is required to tailor improvements.' });
      return;
    }

    const ai = getGeminiClient();
    const safeSuggested = Array.isArray(suggestedKeywords)
      ? suggestedKeywords.filter((k): k is string => typeof k === 'string').slice(0, 20)
      : [];

    const systemInstruction = `You are an executive resume writer and ATS optimization specialist.
Rewrite the candidate's professional summary, key work experience bullet points, and skills grouping so they read cleanly to both human recruiters and Applicant Tracking Systems.

STRICT FACTUAL INTEGRITY RULES:
1. Only include skills, tools, job roles, industries, and achievements actually supported by the candidate's resume.
2. NEVER invent metrics, percentages, dollar figures, certifications, or employers. If a bullet would benefit from a specific number that is missing in the original resume, keep the wording truthful or use an explicit bracketed prompt like "[insert metric]" so the candidate fills in their real figure.
3. Incorporate supported keywords from the job description naturally without keyword stuffing.`;

    const prompt = `Target Job Description:
${jobDescription.trim().slice(0, 14000)}

Candidate Resume:
${resumeText.trim().slice(0, 28000)}

Supported keywords to naturally weave in if relevant:
${safeSuggested.join(', ') || 'None specified'}

Provide:
1. A sharp, ATS-friendly improved professional summary (3-4 sentences).
2. 4 to 6 rewritten work experience bullet points (quoting the original bullet and showing the upgraded ATS version + brief reason).
3. An organized, ATS-clean Skills section containing ONLY verified skills from the candidate's resume, aligned to the job's terminology where accurate.
4. Brief tailoring notes explaining what changed and reminding the candidate to fill any bracketed placeholders with real figures.`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              improvedSummary: { type: Type.STRING },
              rewrittenBullets: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original: { type: Type.STRING },
                    improved: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['original', 'improved', 'reason'],
                },
              },
              optimizedSkillsSection: { type: Type.STRING },
              tailoringNotes: { type: Type.STRING },
            },
            required: [
              'improvedSummary',
              'rewrittenBullets',
              'optimizedSkillsSection',
              'tailoringNotes',
            ],
          },
        },
      })
    );

    const rawJson = (response.text ?? '').trim();
    if (!rawJson) {
      throw new AppError('Gemini returned an empty response.', 502);
    }
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    const payload: ResumeImproverResult = {
      improvedSummary:
        typeof parsed.improvedSummary === 'string' ? parsed.improvedSummary.trim() : '',
      rewrittenBullets: sanitizeBullets(parsed.rewrittenBullets),
      optimizedSkillsSection:
        typeof parsed.optimizedSkillsSection === 'string'
          ? parsed.optimizedSkillsSection.trim()
          : '',
      tailoringNotes:
        typeof parsed.tailoringNotes === 'string' ? parsed.tailoringNotes.trim() : '',
    };

    res.json(payload);
  } catch (error: unknown) {
    const appErr = mapGeminiError(error);
    res.status(appErr.statusCode).json({ error: appErr.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ATS Resume Analyzer server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
