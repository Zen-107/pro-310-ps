'use client';

import { avatarColors } from '@/lib/kids';
import { GROUND, SEG, add, dir, type DemoGuide, type Limb, type Pt, type Skeleton } from '@/lib/exercise-poses';

// "น้องยืด" doing an exercise demo (decision 0003). The pose comes from the
// same rig as the measured demo (lib/exercise-poses.ts), so every limb angle is
// the one the camera checks; only the drawing is different: a round mochi
// body with the face on it, chunky outlined limbs, mitten hands, a swaying
// sprout, blinking eyes, and a happy face with stars at the end pose.

const INK = '#3B2A4A';
const CHEEK = '#FF8FA8';
const LEAF = '#6CCB8A';
const LEAF_DARK = '#3E9E62';
const MOUTH = '#E65A6E';

const r = (v: number) => Math.round(v * 100) / 100;
const OUT = 2.4; // outline thickness (scene units)
const ARM_W = 10;
const LEG_W = 15;

// Chibi proportions: every limb segment keeps its direction (so every joint
// angle is unchanged) but is shorter; the figure then drops so the lowest
// foot stands on the floor again.
const ARM_K = 0.74;
const LEG_K = 0.56;

const lerpPt = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const shift = (p: Pt, dy: number): Pt => ({ x: p.x, y: p.y + dy });

function shortLimb(l: Limb, k: number): Limb {
  const mid = lerpPt(l.root, l.mid, k);
  const end = add(mid, { x: l.end.x - l.mid.x, y: l.end.y - l.mid.y }, k);
  const tip = add(end, { x: l.tip.x - l.end.x, y: l.tip.y - l.end.y }, 1);
  return { root: l.root, mid, end, tip };
}
const shiftLimb = (l: Limb, dy: number): Limb => ({ root: shift(l.root, dy), mid: shift(l.mid, dy), end: shift(l.end, dy), tip: shift(l.tip, dy) });
const moveLimb = (l: Limb, v: Pt): Limb => ({ root: add(l.root, v), mid: add(l.mid, v), end: add(l.end, v), tip: add(l.tip, v) });

// Front view: the round body is wider than the rig's shoulders, so the arms
// move out to the body's edge (directions unchanged) instead of hiding behind it
const SHOULDER_OUT = 9;
function outward(skel: Skeleton, root: Pt): Pt {
  if (skel.view !== 'front') return { x: 0, y: 0 };
  const v = { x: root.x - skel.neck.x, y: root.y - skel.neck.y };
  const L = Math.hypot(v.x, v.y) || 1;
  return { x: (v.x / L) * SHOULDER_OUT, y: (v.y / L) * SHOULDER_OUT };
}

/** Chibi version of a rig skeleton, standing on the same floor, plus the guide mapping for its shorter arms */
export function chibi(skel: Skeleton): { skel: Skeleton; guide: (g: DemoGuide) => DemoGuide } {
  const outNear = outward(skel, skel.armNear.root);
  const outFar = outward(skel, skel.armFar.root);
  const armNear = moveLimb(shortLimb(skel.armNear, ARM_K), outNear);
  const armFar = moveLimb(shortLimb(skel.armFar, ARM_K), outFar);
  const legNear = shortLimb(skel.legNear, LEG_K);
  const legFar = shortLimb(skel.legFar, LEG_K);
  const lowest = Math.max(legNear.end.y, legFar.end.y);
  const lowestBefore = Math.max(skel.legNear.end.y, skel.legFar.end.y);
  const dy = lowestBefore - lowest;
  const out: Skeleton = {
    view: skel.view,
    hip: shift(skel.hip, dy),
    neck: shift(skel.neck, dy),
    headCenter: shift(skel.headCenter, dy),
    armNear: shiftLimb(armNear, dy),
    armFar: shiftLimb(armFar, dy),
    legNear: shiftLimb(legNear, dy),
    legFar: shiftLimb(legFar, dy),
  };
  // A hand's motion path shrinks with its arm, around the shoulder it belongs to
  const guide = (g: DemoGuide): DemoGuide => {
    const near = Math.hypot(g.center.x - skel.armNear.root.x, g.center.y - skel.armNear.root.y);
    const far = Math.hypot(g.center.x - skel.armFar.root.x, g.center.y - skel.armFar.root.y);
    const root = near <= far ? skel.armNear.root : skel.armFar.root;
    const out = near <= far ? outNear : outFar;
    return { ...g, center: shift(add(lerpPt(root, g.center, ARM_K), out), dy), radius: g.radius * ARM_K };
  };
  return { skel: out, guide };
}

/** Chunky outlined limb: an ink stroke under a body-coloured stroke, so joints stay round */
function LimbShape({ l, w, fill, hand }: { l: Limb; w: number; fill: string; hand: boolean }) {
  const d = `M${r(l.root.x)},${r(l.root.y)} L${r(l.mid.x)},${r(l.mid.y)} L${r(l.end.x)},${r(l.end.y)}`;
  const endDir = Math.atan2(l.tip.y - l.end.y, l.tip.x - l.end.x);
  const endDeg = (endDir * 180) / Math.PI;
  const tipAt = add(l.end, { x: Math.cos(endDir), y: Math.sin(endDir) }, hand ? 2.5 : 4.5);
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + OUT * 2} strokeLinecap="round" strokeLinejoin="round" />
      {hand ? (
        <circle cx={r(tipAt.x)} cy={r(tipAt.y)} r={w * 0.62} fill={fill} stroke={INK} strokeWidth={OUT} />
      ) : (
        <ellipse
          cx={r(tipAt.x)}
          cy={r(tipAt.y)}
          rx={w * 0.78}
          ry={w * 0.5}
          fill={fill}
          stroke={INK}
          strokeWidth={OUT}
          transform={`rotate(${r(endDeg)} ${r(tipAt.x)} ${r(tipAt.y)})`}
        />
      )}
      <path d={d} fill="none" stroke={fill} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function Star({ cx, cy, size, spin }: { cx: number; cy: number; size: number; spin: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = ((i * 36 - 90 + spin) * Math.PI) / 180;
    const rad = i % 2 ? size * 0.45 : size;
    return `${r(cx + Math.cos(a) * rad)},${r(cy + Math.sin(a) * rad)}`;
  }).join(' ');
  return <polygon points={pts} fill="#FFC93C" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />;
}

export function MascotFigure({
  skel,
  sec,
  cheer,
  avatar,
}: {
  skel: Skeleton;
  /** Animation clock (seconds) for blinking and the swaying sprout */
  sec: number;
  /** At the end pose: happy face and stars */
  cheer: boolean;
  /** The child's own mascot look (colour key or look string); default peach */
  avatar?: string | null;
}) {
  const { body, belly } = avatarColors(avatar);
  const side = skel.view === 'side';
  const trunk = Math.atan2(skel.neck.y - skel.hip.y, skel.neck.x - skel.hip.x);
  const trunkDeg = (trunk * 180) / Math.PI;
  // 0 = upright. Side view: the body leans only part of the way so the face
  // stays readable (the legs still show the real knee and hip angles)
  const tilt = (trunkDeg + 90) * (side ? 0.55 : 1);
  // Mochi: one round body-head over the trunk, a little past the neck
  // Side view: smaller and higher so the thighs show and a squat reads clearly
  const rx = side ? 25 : 32;
  const ry = side ? 33 : 40;
  const c = add(skel.hip, dir(trunkDeg), SEG.torso * (side ? 0.78 : 0.6));
  const blink = sec % 3.4 > 3.25; // short blink every few seconds
  const sway = Math.sin(sec * 2.4) * 9;

  // Arms behind the body so they grow out of its sides (in the side view too,
  // so a hanging arm never covers the face)
  const farLeg = <LimbShape l={skel.legFar} w={LEG_W} fill={body} hand={false} />;
  const nearLeg = <LimbShape l={skel.legNear} w={LEG_W} fill={body} hand={false} />;
  const farArm = <LimbShape l={skel.armFar} w={ARM_W} fill={body} hand />;
  const nearArm = <LimbShape l={skel.armNear} w={ARM_W} fill={body} hand />;

  // Face in the body's own frame (x across, y along the trunk, up = −y)
  const faceX = side ? 9 : 0;
  const eyeY = -ry * 0.28;
  const eyes = side ? [faceX - 2, faceX + 11] : [-10, 10];

  return (
    <g>
      {/* ground shadow */}
      <ellipse cx={r(skel.hip.x + (side ? 4 : 0))} cy={GROUND + 1} rx={side ? 38 : 34} ry={4.5} fill={INK} opacity={0.12} />

      {farArm}
      {farLeg}
      {nearLeg}
      {nearArm}

      <g transform={`translate(${r(c.x)} ${r(c.y)}) rotate(${r(tilt)})`}>
        {/* sprout */}
        <g transform={`translate(0 ${-ry + 2}) rotate(${r(sway)})`}>
          <path d="M0 0 Q-1 -7 1 -12" stroke={LEAF_DARK} strokeWidth={2.6} fill="none" strokeLinecap="round" />
          <path d="M1 -10 Q10 -21 20 -14 Q11 -6 1 -10 Z" fill={LEAF} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
          <path d="M0 -7 Q-8 -17 -17 -12 Q-10 -4 0 -7 Z" fill={LEAF} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        </g>
        <ellipse cx={0} cy={0} rx={rx} ry={ry} fill={body} stroke={INK} strokeWidth={OUT + 0.6} />
        <ellipse cx={side ? 4 : 0} cy={ry * 0.42} rx={rx * 0.58} ry={ry * 0.4} fill={belly} />
        <ellipse cx={-rx * 0.45} cy={-ry * 0.58} rx={6} ry={3.4} fill="#fff" opacity={0.5} transform={`rotate(-30 ${r(-rx * 0.45)} ${r(-ry * 0.58)})`} />

        {/* cheeks */}
        {(side ? [faceX + 15] : [-17, 17]).map((x) => (
          <ellipse key={x} cx={x} cy={eyeY + 10} rx={5} ry={3} fill={CHEEK} opacity={0.8} />
        ))}

        {/* eyes: ^ ^ when cheering, closed lines when blinking, big shiny ovals otherwise */}
        {cheer ? (
          <g stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none">
            {eyes.map((x) => (
              <path key={x} d={`M${x - 4.5} ${eyeY + 2} L${x} ${eyeY - 3} L${x + 4.5} ${eyeY + 2}`} />
            ))}
          </g>
        ) : blink ? (
          <g stroke={INK} strokeWidth={2.4} strokeLinecap="round">
            {eyes.map((x) => (
              <path key={x} d={`M${x - 4.5} ${eyeY} Q${x} ${eyeY + 3} ${x + 4.5} ${eyeY}`} fill="none" />
            ))}
          </g>
        ) : (
          eyes.map((x, i) => (
            <g key={x}>
              <ellipse cx={x} cy={eyeY} rx={side && i === 0 ? 3.6 : 4.6} ry={5.8} fill={INK} />
              <circle cx={x + 1.6} cy={eyeY - 2.4} r={1.9} fill="#fff" />
              <circle cx={x - 1.4} cy={eyeY + 2.2} r={0.9} fill="#fff" />
            </g>
          ))
        )}

        {/* mouth: open smile when cheering, little "w" otherwise */}
        {cheer ? (
          <path
            d={`M${faceX + (side ? 0 : -6)} ${eyeY + 8} Q${faceX + (side ? 5 : 0)} ${eyeY + 17} ${faceX + (side ? 10 : 6)} ${eyeY + 8} Z`}
            fill={MOUTH}
            stroke={INK}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        ) : (
          <path
            d={side
              ? `M${faceX + 1} ${eyeY + 9} Q${faceX + 4} ${eyeY + 12} ${faceX + 6} ${eyeY + 9} Q${faceX + 8} ${eyeY + 12} ${faceX + 11} ${eyeY + 9}`
              : `M-5 ${eyeY + 9} Q-2.5 ${eyeY + 12.5} 0 ${eyeY + 9.5} Q2.5 ${eyeY + 12.5} 5 ${eyeY + 9}`}
            fill="none"
            stroke={INK}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </g>


      {cheer && (
        <g>
          <Star cx={r(c.x - 34)} cy={r(c.y - 30)} size={7} spin={sec * 90} />
          <Star cx={r(c.x + 36)} cy={r(c.y - 40)} size={5.5} spin={-sec * 120} />
          <Star cx={r(c.x + 30)} cy={r(c.y + 6)} size={4} spin={sec * 150} />
        </g>
      )}
    </g>
  );
}

/** Scene area that holds every demo pose at full size (the rig's 260×200 scene, cropped) */
export const MASCOT_VIEWBOX = { x: 45, y: 24, w: 170, h: 176 };

/** Point helper re-exported for callers that place overlays on the figure */
export type { Pt };
