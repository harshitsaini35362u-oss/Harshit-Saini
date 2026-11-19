import { useEffect, useState } from 'react';
import type { ScoreCategory } from '../types/ats';

interface ScoreGaugeProps {
  score: number;
  category: ScoreCategory;
}

const CATEGORY_STYLES: Record<
  ScoreCategory,
  { stroke: string; text: string; bg: string; label: string; summary: string }
> = {
  Excellent: {
    stroke: '#10B981',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    label: 'Excellent Match',
    summary: 'Strong keyword alignment and clear ATS readability.',
  },
  Good: {
    stroke: '#38BDF8',
    text: 'text-sky-300',
    bg: 'bg-sky-500/10 border-sky-500/30',
    label: 'Good Match',
    summary: 'Solid foundation; targeted keyword tuning can raise match rate.',
  },
  Average: {
    stroke: '#FBBF24',
    text: 'text-amber-300',
    bg: 'bg-amber-500/10 border-amber-500/30',
    label: 'Average Match',
    summary: 'Noticeable keyword or role alignment gaps to address before applying.',
  },
  Poor: {
    stroke: '#FB7185',
    text: 'text-rose-300',
    bg: 'bg-rose-500/10 border-rose-500/30',
    label: 'Poor Match',
    summary: 'Low alignment with job requirements; major tailoring recommended.',
  },
};

export function ScoreGauge({ score, category }: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const style = CATEGORY_STYLES[category];

  const radius = 66;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (displayScore / 100) * circumference;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayScore(clampedScore);
      return;
    }

    let frameId = 0;
    const durationMs = 700;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * clampedScore));
      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [clampedScore]);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative inline-flex items-center justify-center">
        <svg
          width="172"
          height="172"
          viewBox="0 0 172 172"
          className="-rotate-90"
          role="img"
          aria-label={`Overall ATS compatibility score ${clampedScore} out of 100, ${category}`}
        >
          <circle
            cx="86"
            cy="86"
            r={radius}
            fill="none"
            stroke="#27272A"
            strokeWidth={strokeWidth}
          />
          <circle
            cx="86"
            cy="86"
            r={radius}
            fill="none"
            stroke={style.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 120ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-4xl font-bold tracking-tight text-zinc-50 tabular-nums">
            {displayScore}
          </span>
          <span className="text-xs font-medium text-zinc-400 tabular-nums">out of 100</span>
        </div>
      </div>

      <div
        className={`mt-4 inline-flex items-center border px-3 py-1 rounded-md text-xs font-semibold ${style.bg} ${style.text}`}
      >
        {style.label}
      </div>
      <p className="mt-2.5 max-w-[240px] text-xs leading-relaxed text-zinc-400">
        {style.summary}
      </p>
    </div>
  );
}
