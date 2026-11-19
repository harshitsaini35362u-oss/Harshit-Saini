const CAPABILITIES = [
  {
    index: '01',
    title: 'Direct ATS Text Parsing',
    description:
      'Extracts raw selectable text from PDF and DOCX resumes on the server, catching unreadable formatting before recruiters see your application.',
  },
  {
    index: '02',
    title: 'Weighted 7-Dimension Scoring',
    description:
      'Scores keyword match, technical stack, work experience, role alignment, education, readability, and soft skills using transparent fixed weights.',
  },
  {
    index: '03',
    title: 'Truthful Keyword Diagnostics',
    description:
      'Separates matched skills from genuine gaps and suggests terminology only when backed by real evidence already present in your resume.',
  },
  {
    index: '04',
    title: 'Rewrite Studio & Score History',
    description:
      'Produces copy-ready bullet upgrades, downloadable PDF reports, and persistent Recharts trend tracking across saved resume iterations.',
  },
];

const SCORING_WEIGHTS = [
  {
    criterion: 'Keyword Match',
    weight: '25%',
    focus: 'Exact and semantic alignment with role-specific terms and phrases in the job posting.',
  },
  {
    criterion: 'Technical Skills',
    weight: '20%',
    focus: 'Coverage of required languages, tools, software platforms, and technical methods.',
  },
  {
    criterion: 'Work Experience',
    weight: '20%',
    focus: 'Relevance of past responsibilities, seniority, domain scope, and measurable outcomes.',
  },
  {
    criterion: 'Job Title & Role Relevance',
    weight: '10%',
    focus: 'Alignment between your target title, career trajectory, and the advertised role.',
  },
  {
    criterion: 'Education & Certifications',
    weight: '10%',
    focus: 'Degree requirements, academic background, and relevant industry certifications.',
  },
  {
    criterion: 'Resume Structure & Readability',
    weight: '10%',
    focus: 'Clean section hierarchy, scannable bullet points, action verbs, and ATS parsability.',
  },
  {
    criterion: 'Soft Skills',
    weight: '5%',
    focus: 'Evidence of communication, leadership, stakeholder management, and collaboration.',
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Upload PDF or DOCX',
    detail:
      'Drop your resume file. The parser extracts plain text so you can verify exactly what automated systems read.',
  },
  {
    step: '02',
    title: 'Compare Against Target JD',
    detail:
      'Paste the target job posting. Our AI evaluates all seven weighted ATS criteria and maps skill gaps honestly.',
  },
  {
    step: '03',
    title: 'Refine, Save & Track Growth',
    detail:
      'Apply factual bullet-point rewrites, export a PDF report, and save sessions to chart your score improvements.',
  },
];

const FAQS = [
  {
    q: 'Is this score guaranteed by Greenhouse, Lever, or Workday?',
    a: 'No. Each ATS platform uses different internal ranking and search logic, and human recruiters often review resumes directly. This score is an AI-generated estimate designed to help you verify keyword coverage and clarity before applying.',
  },
  {
    q: 'Will the AI Resume Improver invent skills or fake metrics?',
    a: 'Never. Both the analyzer and Resume Improver are strictly instructed to ground every rewrite and suggested keyword in experience already evidenced in your resume. Unmatched requirements are flagged honestly as gaps.',
  },
  {
    q: 'Which file formats work best for ATS compatibility?',
    a: 'Text-based PDF (.pdf) and Word (.docx) resumes with clean single-column structures parse most reliably. Scanned image-only PDFs are unreadable to most ATS parsers and will be flagged immediately upon upload.',
  },
  {
    q: 'How does Saved Score History work?',
    a: 'Sign in with Google to save labeled analysis sessions to your private history. Each saved check plots chronologically on an interactive Recharts trend line so you can measure improvements across resume revisions.',
  },
];

export function LandingSections() {
  return (
    <div className="border-t border-zinc-800/80">
      {/* Capabilities Bento Strip */}
      <section className="bg-zinc-950 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50">
                Engineered for factual resume diagnostics
              </h2>
              <p className="mt-2.5 text-sm sm:text-base text-zinc-400 leading-relaxed">
                Every score, missing skill, and bullet rewrite traces directly to your uploaded document and target role.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {CAPABILITIES.map((cap) => (
              <div
                key={cap.index}
                className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 flex flex-col justify-between"
              >
                <div>
                  <span className="font-mono text-xs font-semibold text-emerald-400">
                    {cap.index}.
                  </span>
                  <h3 className="mt-3 font-display text-base font-semibold text-zinc-100">
                    {cap.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {cap.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Weighted Scoring Model */}
      <section
        id="scoring-model"
        className="border-t border-zinc-800/80 bg-zinc-900/40 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50">
                Weighted 7-Factor Scoring Rubric
              </h2>
              <p className="mt-2 text-sm sm:text-base text-zinc-400">
                Your overall compatibility estimate (0–100) is calculated deterministically from seven weighted dimensions.
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-emerald-400 tabular-nums">
              Total Weight: 100%
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/80 text-xs font-semibold text-zinc-400">
                    <th className="py-3.5 px-5">Evaluation Criterion</th>
                    <th className="py-3.5 px-5 text-right whitespace-nowrap">Weight</th>
                    <th className="py-3.5 px-5">Evaluation Focus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-sm">
                  {SCORING_WEIGHTS.map((row) => (
                    <tr
                      key={row.criterion}
                      className="hover:bg-zinc-900/50 transition-colors"
                    >
                      <td className="py-3.5 px-5 font-medium text-zinc-100 whitespace-nowrap">
                        {row.criterion}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-semibold text-emerald-400 tabular-nums">
                        {row.weight}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-400">{row.focus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="border-t border-zinc-800/80 bg-zinc-950 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50">
              How It Works
            </h2>
            <p className="mt-2 text-sm sm:text-base text-zinc-400">
              From document upload to measurable score gains across revisions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_IT_WORKS_STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6"
              >
                <span className="font-mono text-xs font-semibold text-sky-400">
                  Step {item.step}
                </span>
                <h3 className="mt-2.5 font-display text-lg font-semibold text-zinc-100">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2-Column Editorial FAQ Grid */}
      <section
        id="faq"
        className="border-t border-zinc-800/80 bg-zinc-900/30 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50 mb-10">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FAQS.map((faq) => (
              <div
                key={faq.q}
                className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-6"
              >
                <h3 className="font-display text-base font-semibold text-zinc-100">
                  {faq.q}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
