import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { ExtractedResume } from '../types/ats';

interface UploadWorkspaceProps {
  extractedResume: ExtractedResume | null;
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  onResumeExtracted: (resume: ExtractedResume | null) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  analysisStage: string;
  analysisError: string | null;
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadWorkspace({
  extractedResume,
  jobDescription,
  onJobDescriptionChange,
  onResumeExtracted,
  onAnalyze,
  isAnalyzing,
  analysisStage,
  analysisError,
}: UploadWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [jdError, setJdError] = useState<string | null>(null);
  const [showTextPreview, setShowTextPreview] = useState(false);

  const processFile = async (file: File) => {
    setUploadError(null);
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.doc')) {
      setUploadError(
        'Legacy .doc files are not supported. Please save your resume as .pdf or .docx and try again.'
      );
      return;
    }

    const validExt = lowerName.endsWith('.pdf') || lowerName.endsWith('.docx');
    if (!validExt) {
      setUploadError('Invalid file type. Please upload a PDF (.pdf) or Word (.docx) file.');
      return;
    }

    if (file.size === 0) {
      setUploadError('The selected file is empty.');
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setUploadError(
        `File is too large (${formatFileSize(file.size)}). Maximum allowed size is 10 MB.`
      );
      return;
    }

    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/extract-resume', {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json()) as ExtractedResume & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Could not extract text from this file.');
      }

      onResumeExtracted(data);
      setShowTextPreview(false);
    } catch (err: unknown) {
      onResumeExtracted(null);
      setUploadError(
        err instanceof Error ? err.message : 'Unable to process the uploaded resume.'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isExtracting && !isAnalyzing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isExtracting || isAnalyzing) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleSubmit = () => {
    let hasError = false;
    if (!extractedResume) {
      setUploadError('Please upload a PDF or DOCX resume before analyzing.');
      hasError = true;
    } else {
      setUploadError(null);
    }

    const trimmedJd = jobDescription.trim();
    if (!trimmedJd) {
      setJdError('Please paste the target job description.');
      hasError = true;
    } else if (trimmedJd.length < 30) {
      setJdError(
        'Job description is too short (minimum 30 characters). Include role responsibilities and required skills.'
      );
      hasError = true;
    } else {
      setJdError(null);
    }

    if (!hasError) {
      onAnalyze();
    }
  };

  const jdWordCount = jobDescription.trim()
    ? jobDescription.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div
      id="analyzer"
      className="rounded-2xl border border-zinc-800 bg-zinc-900/90 overflow-hidden"
    >
      {/* Step 1: Resume Document */}
      <div className="p-5 sm:p-6 border-b border-zinc-800">
        <div className="flex items-center justify-between gap-4 mb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-semibold text-emerald-400">01</span>
            <h2 className="font-display text-base font-semibold text-zinc-100">
              Upload Resume Document
            </h2>
          </div>
          <span className="font-mono text-[11px] text-zinc-500 whitespace-nowrap shrink-0">
            PDF / DOCX · 10 MB MAX
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Upload resume file"
          disabled={isExtracting || isAnalyzing}
        />

        {!extractedResume ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => !isExtracting && !isAnalyzing && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !isExtracting && !isAnalyzing) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-xl border border-dashed p-6 flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              isDragging
                ? 'border-emerald-400 bg-emerald-500/10'
                : 'border-zinc-700 bg-zinc-950/70 hover:border-emerald-500/60 hover:bg-zinc-950'
            }`}
          >
            {isExtracting ? (
              <div className="w-full py-3 flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 text-emerald-400 animate-spin shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-zinc-100">
                    Extracting text from your resume...
                  </p>
                  <p className="text-xs text-zinc-400">
                    Parsing document structure and readability
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 text-left">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-emerald-400 border border-zinc-800">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">
                      Drag and drop your resume file
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      Supports text-based PDF and Microsoft Word (.docx)
                    </p>
                  </div>
                </div>
                <span className="rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:border-emerald-500/50 transition-colors whitespace-nowrap shrink-0">
                  Browse File
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {extractedResume.filename}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-mono tabular-nums">
                    <span>{formatFileSize(extractedResume.fileSize)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{extractedResume.wordCount} words</span>
                    {extractedResume.pageCount ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {extractedResume.pageCount}{' '}
                          {extractedResume.pageCount === 1 ? 'page' : 'pages'}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isExtracting || isAnalyzing}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:border-zinc-700 transition-colors disabled:opacity-50"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResumeExtracted(null);
                    setUploadError(null);
                  }}
                  disabled={isAnalyzing}
                  aria-label="Remove uploaded resume"
                  className="rounded-md border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 hover:border-rose-500/40 hover:text-rose-400 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Parsed &amp; ready</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTextPreview((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {showTextPreview ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    <span>Hide extracted text</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span>Inspect extracted text</span>
                  </>
                )}
              </button>
            </div>

            {showTextPreview && (
              <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                {extractedResume.text}
              </pre>
            )}
          </div>
        )}

        {uploadError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Step 2: Job Description */}
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-semibold text-emerald-400">02</span>
            <label
              htmlFor="job-description-input"
              className="font-display text-base font-semibold text-zinc-100"
            >
              Target Job Description
            </label>
          </div>
          {jobDescription.trim().length > 0 && (
            <button
              type="button"
              onClick={() => {
                onJobDescriptionChange('');
                setJdError(null);
              }}
              disabled={isAnalyzing}
              className="text-xs font-medium text-zinc-400 hover:text-zinc-200 whitespace-nowrap shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        <textarea
          id="job-description-input"
          value={jobDescription}
          onChange={(e) => {
            onJobDescriptionChange(e.target.value);
            if (jdError && e.target.value.trim().length >= 30) {
              setJdError(null);
            }
          }}
          disabled={isAnalyzing}
          rows={8}
          placeholder={`Paste the complete job posting here — include:\n• Job Title & Seniority Level\n• Core Responsibilities & Scope\n• Required Technical Skills, Tools & Frameworks\n• Education, Certifications & Soft Skills`}
          className="w-full min-h-[195px] resize-y rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
        />

        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 font-mono tabular-nums">
          <span>
            {jdWordCount} words · {jobDescription.trim().length} chars
          </span>
          <span>Min 30 chars · 100+ words ideal</span>
        </div>

        {jdError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{jdError}</span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="border-t border-zinc-800 bg-zinc-950/60 px-5 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-xs text-zinc-400">
          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-emerald-300 font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400 shrink-0" />
              <span>{analysisStage}</span>
            </div>
          ) : (
            <span>AI-estimated ATS score · Never fabricates skills</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isAnalyzing || isExtracting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing Resume...</span>
            </>
          ) : (
            <>
              <span>Analyze My Resume</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {analysisError && (
        <div
          role="alert"
          className="border-t border-rose-500/30 bg-rose-500/10 px-5 py-3.5 sm:px-6 flex items-start gap-2.5 text-xs text-rose-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-100">Analysis could not be completed</p>
            <p className="mt-0.5 text-rose-300">{analysisError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
