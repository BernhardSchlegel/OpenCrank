import type { Training, TrainingStep } from '../components/power-chart';
import { getFtp } from '../pages/settings';

interface FlatSeg {
  name: string;
  duration: number;
  pctFtp: number;
  startSec: number;
}

export interface SessionSnapshot {
  targetWatts: number;
  segmentName: string;
  segmentRemainingSec: number;
  segmentDurationSec: number;
  segmentIndex: number;
  segmentTotal: number;
  isPaused: boolean;
  effortPct: number;
}

function buildSegs(steps: TrainingStep[], ftp: number): FlatSeg[] {
  const raw: Omit<FlatSeg, 'startSec'>[] = [];

  function walk(ss: TrainingStep[]): void {
    for (const s of ss) {
      if (s.type === 'repeat' && s.steps && s.repeat_times) {
        for (let i = 0; i < s.repeat_times; i++) walk(s.steps);
      } else if (s.type === 'relative' && s.duration_s != null && s.load_rel != null) {
        raw.push({ name: s.name ?? '', duration: s.duration_s, pctFtp: s.load_rel });
      } else if (s.type === 'absolute' && s.duration_s != null && s.load_abs != null) {
        raw.push({ name: s.name ?? '', duration: s.duration_s, pctFtp: Math.round((s.load_abs / ftp) * 100) });
      }
    }
  }

  walk(steps);

  let t = 0;
  return raw.map(r => { const seg: FlatSeg = { ...r, startSec: t }; t += r.duration; return seg; });
}

let selectedTraining: Training | null = null;
let segs: FlatSeg[] = [];
let totalDur = 0;
let startTs = 0;
let pausedAt = 0;
let pausedDuration = 0;
let effortPct = 100;

const listeners = new Set<() => void>();
const selectListeners = new Set<() => void>();

const notify = () => listeners.forEach(cb => cb());
const notifySelect = () => selectListeners.forEach(cb => cb());

export function selectTraining(training: Training): void {
  selectedTraining = training;
  notifySelect();
}

export function getSelectedTraining(): Training | null {
  return selectedTraining;
}

export function onTrainingSelect(cb: () => void): () => void {
  selectListeners.add(cb);
  return () => selectListeners.delete(cb);
}

export function startSession(): void {
  if (!selectedTraining) return;
  effortPct = 100;
  pausedAt = 0;
  pausedDuration = 0;
  segs = buildSegs(selectedTraining.steps, getFtp());
  totalDur = segs.reduce((s, seg) => s + seg.duration, 0);
  startTs = performance.now();
  notify();
}

export function stopSession(): void {
  segs = []; totalDur = 0; startTs = 0; pausedAt = 0; pausedDuration = 0;
  notify();
}

export function isActive(): boolean { return segs.length > 0; }

export function isPaused(): boolean { return pausedAt > 0; }

export function pauseSession(): void {
  if (!isActive() || isPaused()) return;
  pausedAt = performance.now();
  notify();
}

export function resumeSession(): void {
  if (!isActive() || !isPaused()) return;
  pausedDuration += performance.now() - pausedAt;
  pausedAt = 0;
  notify();
}

export function adjustEffort(delta: number): void {
  effortPct = Math.max(50, Math.min(150, effortPct + delta));
  notify();
}

export function skipStep(): void {
  if (!isActive()) return;
  const frozenPause = isPaused() ? performance.now() - pausedAt : 0;
  const elapsed = (performance.now() - startTs - pausedDuration - frozenPause) / 1000;
  let idx = 0;
  while (idx < segs.length - 1 && segs[idx + 1].startSec <= elapsed) idx++;
  const remaining = segs[idx].duration - (elapsed - segs[idx].startSec);
  startTs -= remaining * 1000;
  notify();
}

export function getSnapshot(): SessionSnapshot | null {
  if (!isActive()) return null;

  const frozenPause = isPaused() ? performance.now() - pausedAt : 0;
  const elapsed = (performance.now() - startTs - pausedDuration - frozenPause) / 1000;

  if (elapsed >= totalDur) { stopSession(); return null; }

  let idx = 0;
  while (idx < segs.length - 1 && segs[idx + 1].startSec <= elapsed) idx++;

  const seg = segs[idx];
  return {
    targetWatts: Math.round((seg.pctFtp * getFtp() * effortPct) / 10000),
    segmentName: seg.name,
    segmentRemainingSec: Math.max(0, Math.round(seg.duration - (elapsed - seg.startSec))),
    segmentDurationSec: seg.duration,
    segmentIndex: idx,
    segmentTotal: segs.length,
    isPaused: isPaused(),
    effortPct,
  };
}

export function onSessionChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
