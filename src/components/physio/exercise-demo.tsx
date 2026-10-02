'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import {
  EXERCISE_DEMOS,
  GROUND,
  SEG,
  add,
  buildSkeleton,
  demoProgress,
  dir,
  measure,
  type Limb,
  type Pt,
} from '@/lib/exercise-poses';

// Vector exercise demo: an anatomical silhouette driven by joint-angle
// keyframes (lib/exercise-poses.ts). No video/GIF assets.

interface Target {
  minAngle: number;
  maxAngle: number;
  idealAngle: number;
}

const r = (v: number) => Math.round(v * 100) / 100;

/**
 * Tapered limb outline from p1 to p2 with rounded ends.
 * w1/w2 = half-widths at each end, bulge = extra half-width mid-segment (muscle belly).
 */
function capsule(p1: Pt, p2: Pt, w1: number, w2: number, bulge = 0): string {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const L = Math.hypot(dx, dy) || 1e-6;
  const nx = -dy / L;
  const ny = dx / L;
  const m = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const ctrl = (w1 + w2) / 2 + 2 * bulge; // quadratic control so the curve peaks at mid-width + bulge
  const a1 = { x: p1.x + nx * w1, y: p1.y + ny * w1 };
  const a2 = { x: p2.x + nx * w2, y: p2.y + ny * w2 };
  const b2 = { x: p2.x - nx * w2, y: p2.y - ny * w2 };
  const b1 = { x: p1.x - nx * w1, y: p1.y - ny * w1 };
  const ca = { x: m.x + nx * ctrl, y: m.y + ny * ctrl };
  const cb = { x: m.x - nx * ctrl, y: m.y - ny * ctrl };
  return [
    `M${r(a1.x)},${r(a1.y)}`,
    `Q${r(ca.x)},${r(ca.y)} ${r(a2.x)},${r(a2.y)}`,
    `A${r(w2)},${r(w2)} 0 0 0 ${r(b2.x)},${r(b2.y)}`,
    `Q${r(cb.x)},${r(cb.y)} ${r(b1.x)},${r(b1.y)}`,
    `A${r(w1)},${r(w1)} 0 0 0 ${r(a1.x)},${r(a1.y)}Z`,
  ].join(' ');
}

function arm(l: Limb) {
  return [capsule(l.root, l.mid, 5.4, 4.3, 0.9), capsule(l.mid, l.end, 4.3, 3.0, 0.7), capsule(l.end, l.tip, 3.1, 2.4, 0.3)];
}
function leg(l: Limb) {
  return [capsule(l.root, l.mid, 8.6, 5.6, 1.2), capsule(l.mid, l.end, 5.6, 3.4, 1.4), capsule(l.end, l.tip, 3.6, 2.2, 0.2)];
}

const unit = (v: Pt) => {
  const L = Math.hypot(v.x, v.y) || 1e-6;
  return { x: v.x / L, y: v.y / L };
};
const angleOf = (v: Pt) => (Math.atan2(v.y, v.x) * 180) / Math.PI;

/** SVG arc path around `c` from angle a0 sweeping `sweep` degrees (sign = direction) */
function arcPath(c: Pt, radius: number, a0: number, sweep: number, wedge = false): string {
  const p0 = add(c, dir(a0), radius);
  const p1 = add(c, dir(a0 + sweep), radius);
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  const flag = sweep > 0 ? 1 : 0;
  const arc = `M${r(p0.x)},${r(p0.y)} A${radius},${radius} 0 ${large} ${flag} ${r(p1.x)},${r(p1.y)}`;
  return wedge ? `M${r(c.x)},${r(c.y)} L${r(p0.x)},${r(p0.y)} ${arc.slice(arc.indexOf('A'))} Z` : arc;
}

export function ExerciseDemo({
  slug,
  target,
  compact = false,
  className = '',
}: {
  slug: string;
  target?: Target;
  compact?: boolean;
  className?: string;
}) {
  const demo = EXERCISE_DEMOS[slug];
  const [sec, setSec] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const startRef = useRef<number | null>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Animation clock (~30 fps). Reduced motion: step between start/end poses.
  useEffect(() => {
    if (!playing || !demo) return;
    if (reducedMotion) {
      const id = setInterval(() => setSec((s) => (s < 1 ? 2.5 : 0)), 2000);
      return () => clearInterval(id);
    }
    let raf = 0;
    let last = 0;
    startRef.current = null;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now - offsetRef.current * 1000;
      if (now - last > 33) {
        last = now;
        const s = (now - startRef.current) / 1000;
        offsetRef.current = s;
        setSec(s);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reducedMotion, demo]);

  const frame = useMemo(() => {
    if (!demo) return null;
    const t = demoProgress(demo, sec);
    const skel = buildSkeleton(demo.pose(t));
    const m = measure(skel, demo.measurement);
    return { skel, m };
  }, [demo, sec]);

  if (!demo || !frame) {
    return (
      <div className={`flex items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground ${compact ? 'h-24' : 'h-40'} ${className}`}>
        No demo available
      </div>
    );
  }

  const { skel, m } = frame;
  const side = skel.view === 'side';
  const near = 'fill-slate-300 dark:fill-slate-500';
  const far = side ? 'fill-slate-400 dark:fill-slate-600' : near;
  const active = 'fill-emerald-400 dark:fill-emerald-500';
  const outline = 'stroke-slate-500/40 dark:stroke-slate-900/50';

  const highlightLegNear = ['knee', 'hip', 'hip_flexion', 'hip_opening'].includes(demo.measurement);
  const highlightLegFar = demo.measurement === 'hip_opening';
  const highlightArm = demo.measurement === 'shoulder';

  // Angle overlay: arc from the reference segment toward the moving segment.
  // Hip flexion is drawn from the extension of the trunk line.
  const fromVec =
    demo.measurement === 'hip_flexion' ? unit({ x: m.vertex.x - m.from.x, y: m.vertex.y - m.from.y }) : unit({ x: m.from.x - m.vertex.x, y: m.from.y - m.vertex.y });
  const toVec = unit({ x: m.to.x - m.vertex.x, y: m.to.y - m.vertex.y });
  const sign = fromVec.x * toVec.y - fromVec.y * toVec.x >= 0 ? 1 : -1;
  const a0 = angleOf(fromVec);
  const inRange = target ? m.value >= target.minAngle && m.value <= target.maxAngle : false;
  const labelAt = add(m.vertex, dir(a0 + (sign * m.value) / 2), 30);

  const body = (
    <g className={outline} strokeWidth={0.6}>
      {/* far side (behind) */}
      {leg(skel.legFar).map((d, i) => (
        <path key={`lf${i}`} d={d} className={highlightLegFar && i < 1 ? active : far} />
      ))}
      {arm(skel.armFar).map((d, i) => (
        <path key={`af${i}`} d={d} className={!side && highlightArm ? active : far} />
      ))}
      {/* trunk, neck, head */}
      <path d={capsule(skel.hip, skel.neck, side ? 10.5 : 14.5, side ? 12 : 18.5, side ? 1.5 : -1)} className={near} />
      <path d={capsule(skel.neck, add(skel.neck, unit({ x: skel.headCenter.x - skel.neck.x, y: skel.headCenter.y - skel.neck.y }), SEG.neck + 2), 3.6, 3.4)} className={near} />
      <ellipse cx={r(skel.headCenter.x)} cy={r(skel.headCenter.y)} rx={SEG.headR * 0.92} ry={SEG.headR} className={near} />
      {/* near side (in front) */}
      {leg(skel.legNear).map((d, i) => (
        <path key={`ln${i}`} d={d} className={highlightLegNear && i < 2 && !(demo.measurement === 'hip_opening' && i > 0) ? active : near} />
      ))}
      {arm(skel.armNear).map((d, i) => (
        <path key={`an${i}`} d={d} className={highlightArm ? active : near} />
      ))}
    </g>
  );

  return (
    <div className={`relative rounded-xl border bg-gradient-to-b from-muted/30 to-muted/60 ${className}`}>
      <svg viewBox="0 0 260 200" className={`w-full ${compact ? 'h-28' : 'h-48'}`} role="img" aria-label={`Demonstration: ${demo.caption}`}>
        {/* floor, mat, wall */}
        <line x1={0} y1={GROUND} x2={260} y2={GROUND} className="stroke-slate-400/60" strokeWidth={1} />
        {demo.props.mat && <rect x={20} y={GROUND - 4} width={220} height={4} rx={2} className="fill-sky-200/70 dark:fill-sky-900/60" />}
        {demo.props.wallX !== undefined && (
          <rect x={demo.props.wallX - 6} y={20} width={6} height={GROUND - 20} className="fill-slate-300/80 dark:fill-slate-700" />
        )}

        {body}

        {/* target band + live angle */}
        {target && (
          <path
            d={arcPath(m.vertex, 22, a0 + sign * target.minAngle, sign * (target.maxAngle - target.minAngle), true)}
            className="fill-emerald-500/15 stroke-emerald-500/40"
            strokeWidth={0.6}
          />
        )}
        <path
          d={arcPath(m.vertex, 16, a0, sign * m.value)}
          fill="none"
          className={inRange ? 'stroke-emerald-600 dark:stroke-emerald-400' : 'stroke-amber-500'}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={r(m.vertex.x)} cy={r(m.vertex.y)} r={2.2} className="fill-white stroke-slate-600" strokeWidth={0.8} />
        {!compact && (
          <text
            x={r(labelAt.x)}
            y={r(labelAt.y)}
            textAnchor="middle"
            dominantBaseline="middle"
            className={`text-[9px] font-semibold ${inRange ? 'fill-emerald-700 dark:fill-emerald-300' : 'fill-amber-600 dark:fill-amber-400'}`}
          >
            {Math.round(m.value)}°
          </text>
        )}
      </svg>

      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 text-muted-foreground shadow-sm hover:text-foreground"
        aria-label={playing ? 'Pause demonstration' : 'Play demonstration'}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>

      {!compact && (
        <div className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>{demo.caption}</span>
          {target && (
            <span className="shrink-0 tabular-nums">
              Target {target.minAngle}–{target.maxAngle}°
            </span>
          )}
        </div>
      )}
    </div>
  );
}
