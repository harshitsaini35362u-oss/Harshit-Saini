import { jsPDF } from 'jspdf';
import type { ATSAnalysisResult, ResumeImproverResult } from '../types/ats';

interface ReportMetadata {
  filename: string;
  analyzedAt: Date;
}

export function downloadAtsPdfReport(
  analysis: ATSAnalysisResult,
  meta: ReportMetadata,
  improverResult?: ResumeImproverResult | null
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 44;
  const maxWidth = pageWidth - marginX * 2;
  let y = 0;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 54) {
      doc.addPage();
      y = 48;
    }
  };

  const addSectionHeading = (title: string) => {
    ensureSpace(36);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title, marginX, y);
    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 14;
  };

  const addWrappedParagraph = (
    text: string,
    fontSize = 9.5,
    color: [number, number, number] = [51, 65, 85],
    bold = false
  ) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    const lineHeight = fontSize * 1.42;
    for (const line of lines) {
      ensureSpace(lineHeight + 2);
      doc.text(line, marginX, y);
      y += lineHeight;
    }
    y += 4;
  };

  const addBulletList = (items: string[], prefix = '• ') => {
    if (items.length === 0) {
      addWrappedParagraph('None identified.', 9.5, [100, 116, 139]);
      return;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const lineHeight = 13.5;
    for (const item of items) {
      const wrapped = doc.splitTextToSize(`${prefix}${item}`, maxWidth - 8) as string[];
      ensureSpace(wrapped.length * lineHeight + 4);
      for (let i = 0; i < wrapped.length; i++) {
        doc.text(wrapped[i], marginX + (i === 0 ? 0 : 10), y);
        y += lineHeight;
      }
      y += 2;
    }
  };

  // Top Header Bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 84, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('ATS Resume Analyzer', marginX, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('AI-Estimated ATS Compatibility & Optimization Report', marginX, 54);

  y = 108;

  // Metadata & Score Summary Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, y, maxWidth, 72, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Resume: ${meta.filename}`, marginX + 14, y + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Date of Analysis: ${meta.analyzedAt.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    marginX + 14,
    y + 40
  );
  doc.text(
    'Note: Score is an AI-generated estimate, not a guaranteed score from an ATS vendor.',
    marginX + 14,
    y + 56
  );

  // Overall Score Badge on right side of summary box
  const scoreColor: [number, number, number] =
    analysis.overallScore >= 85
      ? [22, 163, 74]
      : analysis.overallScore >= 70
      ? [37, 99, 235]
      : analysis.overallScore >= 50
      ? [217, 119, 6]
      : [220, 38, 38];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(`${analysis.overallScore}/100`, pageWidth - marginX - 16, y + 34, {
    align: 'right',
  });
  doc.setFontSize(10);
  doc.text(analysis.scoreCategory.toUpperCase(), pageWidth - marginX - 16, y + 52, {
    align: 'right',
  });

  y += 92;

  if (analysis.summaryFeedback) {
    addSectionHeading('Executive Summary');
    addWrappedParagraph(analysis.summaryFeedback);
  }

  // Score Breakdown Table
  addSectionHeading('Weighted Score Breakdown');
  const categories: Array<{ label: string; weight: string; score: number }> = [
    { label: 'Keyword Match', weight: '25%', score: analysis.scoreBreakdown.keywordMatch },
    { label: 'Technical Skills', weight: '20%', score: analysis.scoreBreakdown.technicalSkills },
    { label: 'Work Experience', weight: '20%', score: analysis.scoreBreakdown.workExperience },
    { label: 'Job Title & Role Relevance', weight: '10%', score: analysis.scoreBreakdown.jobTitleRelevance },
    {
      label: 'Education & Certifications',
      weight: '10%',
      score: analysis.scoreBreakdown.educationCertifications,
    },
    { label: 'Soft Skills', weight: '5%', score: analysis.scoreBreakdown.softSkills },
    {
      label: 'Resume Structure & Readability',
      weight: '10%',
      score: analysis.scoreBreakdown.formattingReadability,
    },
  ];

  for (const cat of categories) {
    ensureSpace(22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`${cat.label} (${cat.weight})`, marginX, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${cat.score} / 100`, pageWidth - marginX, y, { align: 'right' });

    const barX = marginX + 220;
    const barW = maxWidth - 280;
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(barX, y - 7, barW, 6, 3, 3, 'F');
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(barX, y - 7, Math.max(4, (barW * cat.score) / 100), 6, 3, 3, 'F');
    y += 18;
  }

  // Keyword Analysis
  addSectionHeading('Keyword Analysis');
  addWrappedParagraph('Matched Keywords:', 9.5, [22, 163, 74], true);
  addWrappedParagraph(
    analysis.matchedKeywords.length > 0 ? analysis.matchedKeywords.join(', ') : 'None detected.'
  );

  addWrappedParagraph('Missing Keywords:', 9.5, [220, 38, 38], true);
  addWrappedParagraph(
    analysis.missingKeywords.length > 0 ? analysis.missingKeywords.join(', ') : 'None identified.'
  );

  if (analysis.missingTechnicalSkills.length > 0) {
    addWrappedParagraph('Missing Technical Skills:', 9.5, [180, 83, 9], true);
    addWrappedParagraph(analysis.missingTechnicalSkills.join(', '));
  }

  if (analysis.suggestedKeywords.length > 0) {
    addWrappedParagraph('Suggested Keywords (Supported by Experience):', 9.5, [30, 64, 175], true);
    addWrappedParagraph(analysis.suggestedKeywords.join(', '));
  }

  // Strengths & Weaknesses
  addSectionHeading('Resume Strengths');
  addBulletList(analysis.strengths);

  addSectionHeading('Identified Weaknesses');
  addBulletList(analysis.weaknesses);

  // Recommendations
  addSectionHeading('Actionable Recommendations');
  if (analysis.categorizedRecommendations.length > 0) {
    addBulletList(
      analysis.categorizedRecommendations.map(
        (rec) => `[${rec.area} - ${rec.priority} Priority] ${rec.advice}`
      )
    );
  } else {
    addBulletList(analysis.recommendations);
  }

  // Improved Professional Summary
  const summaryToInclude =
    improverResult?.improvedSummary || analysis.improvedProfessionalSummary;
  if (summaryToInclude) {
    addSectionHeading('Recommended Professional Summary');
    addWrappedParagraph(summaryToInclude);
  }

  // Before & After Bullet Points
  const bulletsToInclude =
    improverResult?.rewrittenBullets && improverResult.rewrittenBullets.length > 0
      ? improverResult.rewrittenBullets
      : analysis.improvedBulletPoints;

  if (bulletsToInclude.length > 0) {
    addSectionHeading('Before & After Bullet Point Examples');
    for (const item of bulletsToInclude) {
      ensureSpace(54);
      addWrappedParagraph(`Original: ${item.original}`, 9, [100, 116, 139]);
      addWrappedParagraph(`Improved: ${item.improved}`, 9.5, [15, 23, 42], true);
      if (item.reason) {
        addWrappedParagraph(`Why it works: ${item.reason}`, 8.5, [71, 85, 105]);
      }
      y += 4;
    }
  }

  // Checklist
  if (analysis.optimizationChecklist.length > 0) {
    addSectionHeading('Resume Optimization Checklist');
    addBulletList(analysis.optimizationChecklist, '[ ] ');
  }

  // Page numbers footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `ATS Resume Analyzer · Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 24,
      { align: 'center' }
    );
  }

  const safeBaseName = meta.filename.replace(/\.(pdf|docx)$/i, '').replace(/[^a-z0-9-_]+/gi, '_');
  doc.save(`${safeBaseName || 'resume'}_ATS_Report.pdf`);
}
