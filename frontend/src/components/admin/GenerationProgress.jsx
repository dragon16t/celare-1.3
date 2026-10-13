import React, { useEffect, useState } from 'react';
import { Sparkles, Check, Loader2 } from 'lucide-react';

const STEPS = [
  { key: 'classifying', label: 'Classify' },
  { key: 'writing copy', label: 'Write copy' },
  { key: 'generating image', label: 'AI image' },
  { key: 'saving product', label: 'Save' },
  { key: 'building gallery', label: 'Gallery' },
];

const stepIndex = (step) => {
  const s = (step || '').toLowerCase();
  if (s === 'done') return STEPS.length;
  return STEPS.findIndex((x) => s.startsWith(x.key));
};

const fraction = (step) => {
  const i = stepIndex(step);
  if (i >= STEPS.length) return 1;
  return i < 0 ? 0.03 : (i + 0.5) / STEPS.length;
};

function useElapsed(startedAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - (startedAt || now)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const StepRow = ({ step }) => {
  const cur = stepIndex(step);
  return (
    <ol className="flex items-start justify-between gap-1 mt-3" data-testid="gen-progress-steps">
      {STEPS.map((s, i) => {
        const done = cur > i;
        const active = cur === i;
        return (
          <li key={s.key} className="flex-1 flex flex-col items-center text-center" data-testid={`gen-step-${i}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors duration-300 ${done ? 'bg-emerald-600 text-white' : active ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500' : 'bg-gray-100 text-gray-500'}`}>
              {done ? <Check size={13} /> : active ? <Loader2 size={13} className="animate-spin" /> : i + 1}
            </span>
            <span className={`mt-1 text-[11px] leading-tight ${active ? 'text-emerald-700 font-semibold' : done ? 'text-gray-700' : 'text-gray-500'}`}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
};

const Bar = ({ value, testId }) => (
  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden" data-testid={testId}>
    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-[width] duration-700 ease-out" style={{ width: `${Math.round(Math.min(1, value) * 100)}%` }} />
  </div>
);

export const GenerationProgress = ({ mode = 'single', name, step, done = 0, failed = 0, total = 1, startedAt }) => {
  const elapsed = useElapsed(startedAt);
  const bulk = mode === 'bulk';
  const overall = bulk ? (done + failed + fraction(step)) / Math.max(1, total) : fraction(step);
  return (
    <div className="fixed z-[60] bottom-3 right-3 left-3 sm:left-auto sm:w-[380px] rounded-2xl bg-white shadow-2xl ring-1 ring-emerald-100 p-4" data-testid="gen-progress-panel" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Sparkles size={16} /></span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">{bulk ? 'Bulk AI generation' : 'One-click AI product'}</p>
            <p className="text-xs text-gray-600 truncate" data-testid="gen-progress-name">{name || 'Preparing…'}</p>
          </div>
        </div>
        <span className="text-xs font-mono text-gray-600 shrink-0" data-testid="gen-progress-elapsed">{elapsed}</span>
      </div>
      {bulk && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-700 mb-1">
            <span data-testid="gen-progress-count">Product {Math.min(done + failed + 1, total)} of {total}</span>
            <span>{done} done{failed ? ` · ${failed} failed` : ''}</span>
          </div>
        </div>
      )}
      <div className={bulk ? '' : 'mt-3'}>
        <Bar value={overall} testId="gen-progress-bar" />
        <p className="mt-1 text-right text-[11px] text-gray-600" data-testid="gen-progress-percent">{Math.round(overall * 100)}%</p>
      </div>
      <StepRow step={step} />
    </div>
  );
};
