export interface TrainingStep {
  type: 'relative' | 'absolute' | 'repeat';
  name?: string;
  duration_s?: number;
  load_rel?: number;
  load_abs?: number;
  repeat_times?: number;
  steps?: TrainingStep[];
}

export interface Training {
  name: string;
  description: string;
  steps: TrainingStep[];
}

interface Segment {
  duration: number;
  pctFtp: number;
}

function flatten(steps: TrainingStep[], ftp: number): Segment[] {
  const out: Segment[] = [];
  for (const step of steps) {
    if (step.type === 'repeat' && step.steps && step.repeat_times) {
      for (let i = 0; i < step.repeat_times; i++) out.push(...flatten(step.steps, ftp));
    } else if (step.type === 'relative' && step.duration_s != null && step.load_rel != null) {
      out.push({ duration: step.duration_s, pctFtp: step.load_rel });
    } else if (step.type === 'absolute' && step.duration_s != null && step.load_abs != null) {
      out.push({ duration: step.duration_s, pctFtp: Math.round((step.load_abs / ftp) * 100) });
    }
  }
  return out;
}

export function totalDurationSec(steps: TrainingStep[]): number {
  let total = 0;
  for (const step of steps) {
    if (step.type === 'repeat' && step.steps && step.repeat_times) {
      total += step.repeat_times * totalDurationSec(step.steps);
    } else if (step.duration_s) {
      total += step.duration_s;
    }
  }
  return total;
}

function zoneColor(pctFtp: number): string {
  if (pctFtp > 105) return '#ff3c3c';
  if (pctFtp >= 88)  return '#e8ff00';
  return '#00c875';
}

// ── Static training preview chart (SVG) ──────────────────────────────────────

export function renderChart(
  container: HTMLElement,
  training: Training,
  ftp: number,
  currentSec?: number,
): void {
  const segments = flatten(training.steps, ftp);
  if (segments.length === 0) return;

  const totalDur = segments.reduce((s, seg) => s + seg.duration, 0);
  const maxPct   = Math.max(...segments.map(s => s.pctFtp), 110);
  const W = 400, H = 64, padB = 2;
  const chartH = H - padB;

  let bars = '';
  let xAcc = 0;
  for (const seg of segments) {
    const x = (xAcc / totalDur) * W;
    const w = Math.max((seg.duration / totalDur) * W, 0.5);
    const h = (seg.pctFtp / maxPct) * chartH;
    bars += `<rect x="${x.toFixed(2)}" y="${(H - padB - h).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${zoneColor(seg.pctFtp)}" opacity="0.85"/>`;
    xAcc += seg.duration;
  }

  const ftpY   = (H - padB - (100 / maxPct) * chartH).toFixed(2);
  const ftpLine = `<line x1="0" y1="${ftpY}" x2="${W}" y2="${ftpY}" stroke="#e8ff00" stroke-width="1" stroke-dasharray="3 3" opacity="0.4"/>`;

  const playhead = currentSec != null && totalDur > 0
    ? (() => { const px = ((currentSec / totalDur) * W).toFixed(2); return `<line x1="${px}" y1="0" x2="${px}" y2="${H}" stroke="#fff" stroke-width="1.5" opacity="0.8"/>`; })()
    : '';

  container.innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="100%" display="block">${bars}${ftpLine}${playhead}</svg>`;
}

// ── Live rolling power chart (Canvas) ────────────────────────────────────────

const WINDOW_SEC = 300; // 5 minutes

export class LiveChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private samples: number[] = [];
  private ftp: number;
  private dirty = true;
  private rafId = 0;
  private dpr = window.devicePixelRatio || 1;

  constructor(container: HTMLElement, ftp: number) {
    this.ftp = ftp;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'width:100%;height:100%;display:block;';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.rafId = requestAnimationFrame(this.loop);
  }

  private loop = () => {
    if (this.dirty) { this.draw(); this.dirty = false; }
    this.rafId = requestAnimationFrame(this.loop);
  };

  addSample(watts: number): void {
    this.samples.push(watts);
    if (this.samples.length > WINDOW_SEC) this.samples.shift();
    this.dirty = true;
  }

  setFtp(ftp: number): void { this.ftp = ftp; this.dirty = true; }

  private draw(): void {
    const W = this.canvas.offsetWidth;
    const H = this.canvas.offsetHeight;
    if (W === 0 || H === 0) return;

    // Sync physical pixel size (handles resize & first draw)
    const pw = Math.round(W * this.dpr);
    const ph = Math.round(H * this.dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width  = pw;
      this.canvas.height = ph;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    const { samples, ftp } = this;
    const n = samples.length;
    if (n < 2) return;

    const maxW = Math.max(Math.max(...samples), ftp * 1.3);
    const padB = 4;
    const chartH = H - padB;

    const toX = (i: number) => (i / (n - 1)) * W;
    const toY = (w: number) => H - padB - (w / maxW) * chartH;

    const pts = samples.map((w, i) => ({ x: toX(i), y: toY(w) }));

    // Catmull-Rom spline
    const spline = new Path2D();
    spline.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, n - 1)];
      spline.bezierCurveTo(
        p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
        p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
        p2.x, p2.y,
      );
    }

    // Closed fill area
    const area = new Path2D(spline);
    area.lineTo(pts[n - 1].x, H);
    area.lineTo(pts[0].x, H);
    area.closePath();

    // Fill color based on current sample's zone — no stripes
    const currentWatts = samples[n - 1];
    const zoneRgb = currentWatts > ftp * 1.05 ? '255,60,60'
                  : currentWatts >= ftp * 0.88 ? '232,255,0'
                  : '0,200,117';
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `rgba(${zoneRgb},0.90)`);
    grad.addColorStop(1, `rgba(${zoneRgb},0.15)`);
    ctx.fillStyle = grad;
    ctx.fill(area);

    // Spline stroke
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth   = 1.5;
    ctx.stroke(spline);

    // FTP dashed reference line
    const ftpY = toY(ftp);
    if (ftpY > 0 && ftpY < H) {
      ctx.save();
      ctx.strokeStyle = 'rgba(232,255,0,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, ftpY);
      ctx.lineTo(W, ftpY);
      ctx.stroke();
      ctx.restore();
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.canvas.remove();
  }
}
