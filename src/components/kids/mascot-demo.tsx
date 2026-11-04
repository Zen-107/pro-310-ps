'use client';

import { avatarColors } from '@/lib/kids';
import { add, type DemoGuide, type Limb, type Pt, type Skeleton } from '@/lib/exercise-poses';

// "น้องยืด" doing an exercise demo (decisions 0003, 0004): a cartoon kid on
// two legs whose body parts read clearly: round head with the mascot's face
// and sprout, neck, T-shirt torso, shorts at the hips, two legs with shoes.
// The pose comes from the same rig as the measured demo (lib/exercise-poses.ts):
// segments are shortened for kid proportions but keep their directions, so
// every joint angle is the one the camera checks.

const INK = '#3B2A4A';
const CHEEK = '#FF8FA8';
const LEAF = '#6CCB8A';
const LEAF_DARK = '#3E9E62';
const MOUTH = '#E65A6E';
const SHORTS = '#5B4E8C';
const SHOE = '#FF6F61';
const SOLE = '#FFFFFF';

/** T-shirt colour that stands out against each mascot colour (skin) */
const SHIRT: Record<string, string> = {
  peach: '#5AB0F5',
  sky: '#FFC93C',
  mint: '#FF8C7A',
  grape: '#5ED19A',
  sun: '#9B7BEA',
  coral: '#5AB0F5',
};

const r = (v: number) => Math.round(v * 100) / 100;
const OUT = 2.2; // outline thickness (scene units)
const ARM_W = 7.5;
const LEG_W = 10;

// Kid proportions (about 3.5 heads tall): every segment keeps its direction,
// only its length changes; then the figure drops so the lowest foot stands on
// the floor again.
const TORSO_K = 0.82;
const ARM_K = 0.82;
const LEG_K = 0.74;
const HEAD_R = 19;
const NECK = 4;

const lerpPt = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const shift = (p: Pt, v: Pt): Pt => ({ x: p.x + v.x, y: p.y + v.y });
const unit = (v: Pt): Pt => {
  const L = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / L, y: v.y / L };
};

function shortLimb(l: Limb, k: number, move: Pt): Limb {
  const mid = lerpPt(l.root, l.mid, k);
  const end = add(mid, { x: l.end.x - l.mid.x, y: l.end.y - l.mid.y }, k);
  const tip = add(end, { x: l.tip.x - l.end.x, y: l.tip.y - l.end.y }, 1);
  return { root: shift(l.root, move), mid: shift(mid, move), end: shift(end, move), tip: shift(tip, move) };
}

/** Kid-proportioned version of a rig skeleton on the same floor, plus the guide mapping for its arms */
export function kidRig(skel: Skeleton): { skel: Skeleton; guide: (g: DemoGuide) => DemoGuide } {
  // Shorter trunk: the shoulders (and arms) move down with the neck
  const neck = lerpPt(skel.hip, skel.neck, TORSO_K);
  const armMove = { x: neck.x - skel.neck.x, y: neck.y - skel.neck.y };
  const headDir = unit({ x: skel.headCenter.x - skel.neck.x, y: skel.headCenter.y - skel.neck.y });
  const headCenter = add(neck, headDir, NECK + HEAD_R);
  const legNear = shortLimb(skel.legNear, LEG_K, { x: 0, y: 0 });
  const legFar = shortLimb(skel.legFar, LEG_K, { x: 0, y: 0 });
  const drop = { x: 0, y: Math.max(skel.legNear.end.y, skel.legFar.end.y) - Math.max(legNear.end.y, legFar.end.y) };
  const move = (l: Limb, extra: Pt = { x: 0, y: 0 }): Limb => ({
    root: shift(shift(l.root, extra), drop),
    mid: shift(shift(l.mid, extra), drop),
    end: shift(shift(l.end, extra), drop),
    tip: shift(shift(l.tip, extra), drop),
  });
  const out: Skeleton = {
    view: skel.view,
    hip: shift(skel.hip, drop),
    neck: shift(neck, drop),
    headCenter: shift(headCenter, drop),
    armNear: move(shortLimb(skel.armNear, ARM_K, armMove)),
    armFar: move(shortLimb(skel.armFar, ARM_K, armMove)),
    legNear: move(legNear),
    legFar: move(legFar),
  };
  // A hand's motion path shrinks with its arm, around the shoulder it belongs to
  const guide = (g: DemoGuide): DemoGuide => {
    const near = Math.hypot(g.center.x - skel.armNear.root.x, g.center.y - skel.armNear.root.y);
    const far = Math.hypot(g.center.x - skel.armFar.root.x, g.center.y - skel.armFar.root.y);
    const root = near <= far ? skel.armNear.root : skel.armFar.root;
    return { ...g, center: shift(shift(lerpPt(root, g.center, ARM_K), armMove), drop), radius: g.radius * ARM_K };
  };
  return { skel: out, guide };
}

const path = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${r(p.x)},${r(p.y)}`).join(' ');

/** Outlined limb with a sleeve (arm) or shoe (leg) */
function LimbShape({ l, w, skin, cover, kind }: { l: Limb; w: number; skin: string; cover: string; kind: 'arm' | 'leg' }) {
  const d = path([l.root, l.mid, l.end]);
  const endDir = unit({ x: l.tip.x - l.end.x, y: l.tip.y - l.end.y });
  const endDeg = (Math.atan2(endDir.y, endDir.x) * 180) / Math.PI;
  // Sleeve / shorts leg: the first part of the upper segment
  const coverTo = lerpPt(l.root, l.mid, kind === 'arm' ? 0.55 : 0.5);
  const handAt = add(l.end, endDir, 2);
  const shoeAt = add(l.end, endDir, 3.5);
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d={d} stroke={INK} strokeWidth={w + OUT * 2} />
      <path d={d} stroke={skin} strokeWidth={w} />
      <path d={path([l.root, coverTo])} stroke={INK} strokeWidth={w + 2 + OUT * 2} />
      <path d={path([l.root, coverTo])} stroke={cover} strokeWidth={w + 2} />
      {kind === 'arm' ? (
        <circle cx={r(handAt.x)} cy={r(handAt.y)} r={w * 0.62} fill={skin} stroke={INK} strokeWidth={OUT} />
      ) : (
        <g transform={`rotate(${r(endDeg)} ${r(shoeAt.x)} ${r(shoeAt.y)})`}>
          <ellipse cx={r(shoeAt.x)} cy={r(shoeAt.y)} rx={w * 0.85} ry={w * 0.5} fill={SHOE} stroke={INK} strokeWidth={OUT} />
          <path d={`M${r(shoeAt.x - w * 0.7)},${r(shoeAt.y + w * 0.22)} L${r(shoeAt.x + w * 0.7)},${r(shoeAt.y + w * 0.22)}`} stroke={SOLE} strokeWidth={1.4} />
        </g>
      )}
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
  /** Kid-proportioned skeleton (kidRig) */
  skel: Skeleton;
  /** Animation clock (seconds) for blinking and the swaying sprout */
  sec: number;
  /** At the end pose: happy face and stars */
  cheer: boolean;
  /** The child's own mascot look (colour key or look string); default peach */
  avatar?: string | null;
}) {
  const colors = avatarColors(avatar);
  const skin = colors.body;
  const shirt = SHIRT[colors.id] ?? SHIRT.peach;
  const side = skel.view === 'side';
  const trunkDeg = (Math.atan2(skel.neck.y - skel.hip.y, skel.neck.x - skel.hip.x) * 180) / Math.PI;
  const tilt = trunkDeg + 90; // 0 = upright
  const T = Math.hypot(skel.neck.x - skel.hip.x, skel.neck.y - skel.hip.y);
  const headDeg = (Math.atan2(skel.headCenter.y - skel.neck.y, skel.headCenter.x - skel.neck.x) * 180) / Math.PI + 90;
  const blink = sec % 3.4 > 3.25;
  const sway = Math.sin(sec * 2.4) * 9;

  // Torso in its own frame: hip at (0,0), neck at (0,−T)
  const sh = side ? 9 : 15; // half-width at the shoulders
  const wa = side ? 8.5 : 12; // at the waist
  const shirtPath = `M${-wa} ${-T * 0.22} L${-sh} ${-T + 5} Q${-sh} ${-T - 1} ${-sh + 6} ${-T - 1} L${sh - 6} ${-T - 1} Q${sh} ${-T - 1} ${sh} ${-T + 5} L${wa} ${-T * 0.22} Z`;
  const hw = side ? 9.5 : 13.5; // shorts half-width
  const shortsPath = `M${-wa - 0.5} ${-T * 0.3} L${-hw} ${5} Q${-hw} ${8} ${-hw + 4} ${8} L${hw - 4} ${8} Q${hw} ${8} ${hw} ${5} L${wa + 0.5} ${-T * 0.3} Z`;

  const arm = (l: Limb) => <LimbShape l={l} w={ARM_W} skin={skin} cover={shirt} kind="arm" />;
  const leg = (l: Limb) => <LimbShape l={l} w={LEG_W} skin={skin} cover={SHORTS} kind="leg" />;

  // Face in the head's frame (x across, up = −y); side view looks to +x
  const fx = side ? 7 : 0;
  const eyeY = 1;
  const eyes = side ? [fx + 1, fx + 10] : [-7.5, 7.5];

  const head = (
    <g transform={`translate(${r(skel.headCenter.x)} ${r(skel.headCenter.y)}) rotate(${r(headDeg)})`}>
      {/* sprout */}
      <g transform={`translate(0 ${-HEAD_R + 1}) rotate(${r(sway)})`}>
        <path d="M0 0 Q-1 -6 1 -10" stroke={LEAF_DARK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <path d="M1 -8 Q9 -18 18 -12 Q10 -5 1 -8 Z" fill={LEAF} stroke={INK} strokeWidth={1.7} strokeLinejoin="round" />
        <path d="M0 -6 Q-7 -15 -15 -10 Q-9 -3 0 -6 Z" fill={LEAF} stroke={INK} strokeWidth={1.7} strokeLinejoin="round" />
      </g>
      <circle cx={0} cy={0} r={HEAD_R} fill={skin} stroke={INK} strokeWidth={OUT + 0.4} />
      <ellipse cx={-8} cy={-10} rx={4.5} ry={2.6} fill="#fff" opacity={0.55} transform="rotate(-30 -8 -10)" />
      {(side ? [fx + 12] : [-12, 12]).map((x) => (
        <ellipse key={x} cx={x} cy={eyeY + 7} rx={3.8} ry={2.4} fill={CHEEK} opacity={0.8} />
      ))}
      {cheer ? (
        <g stroke={INK} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" fill="none">
          {eyes.map((x) => (
            <path key={x} d={`M${x - 3.6} ${eyeY + 1.5} L${x} ${eyeY - 2.5} L${x + 3.6} ${eyeY + 1.5}`} />
          ))}
        </g>
      ) : blink ? (
        <g stroke={INK} strokeWidth={2.1} strokeLinecap="round" fill="none">
          {eyes.map((x) => (
            <path key={x} d={`M${x - 3.6} ${eyeY} Q${x} ${eyeY + 2.5} ${x + 3.6} ${eyeY}`} />
          ))}
        </g>
      ) : (
        eyes.map((x, i) => (
          <g key={x}>
            <ellipse cx={x} cy={eyeY} rx={side && i === 0 ? 2.8 : 3.6} ry={4.6} fill={INK} />
            <circle cx={x + 1.3} cy={eyeY - 1.9} r={1.5} fill="#fff" />
            <circle cx={x - 1.1} cy={eyeY + 1.8} r={0.75} fill="#fff" />
          </g>
        ))
      )}
      {cheer ? (
        <path
          d={`M${fx + (side ? 1 : -5)} ${eyeY + 7} Q${fx + (side ? 5 : 0)} ${eyeY + 14} ${fx + (side ? 9 : 5)} ${eyeY + 7} Z`}
          fill={MOUTH}
          stroke={INK}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      ) : (
        <path
          d={`M${fx + (side ? 1 : -4)} ${eyeY + 8} Q${fx + (side ? 3 : -2)} ${eyeY + 10.5} ${fx + (side ? 5 : 0)} ${eyeY + 8.3} Q${fx + (side ? 7 : 2)} ${eyeY + 10.5} ${fx + (side ? 9 : 4)} ${eyeY + 8}`}
          fill="none"
          stroke={INK}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  );

  const neckBase = skel.neck;
  const neckTop = add(skel.neck, unit({ x: skel.headCenter.x - skel.neck.x, y: skel.headCenter.y - skel.neck.y }), NECK + 4);

  return (
    <g>
      {/* ground shadow */}
      <ellipse cx={r(skel.hip.x + (side ? 4 : 0))} cy={r(Math.max(skel.legNear.end.y, skel.legFar.end.y) + 5)} rx={side ? 30 : 28} ry={4} fill={INK} opacity={0.12} />

      {/* far side, behind the body */}
      {arm(skel.armFar)}
      {leg(skel.legFar)}
      {side ? null : leg(skel.legNear)}

      {/* neck, shorts, shirt */}
      <path d={path([neckBase, neckTop])} stroke={INK} strokeWidth={8 + OUT * 2} strokeLinecap="round" />
      <path d={path([neckBase, neckTop])} stroke={skin} strokeWidth={8} strokeLinecap="round" />
      <g transform={`translate(${r(skel.hip.x)} ${r(skel.hip.y)}) rotate(${r(tilt)})`} strokeLinejoin="round">
        <path d={shortsPath} fill={SHORTS} stroke={INK} strokeWidth={OUT} />
        <path d={shirtPath} fill={shirt} stroke={INK} strokeWidth={OUT} />
        {/* collar */}
        <path d={`M-5 ${-T - 0.5} Q0 ${-T + 4} 5 ${-T - 0.5}`} fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      </g>

      {/* near side, in front */}
      {side ? leg(skel.legNear) : null}
      {arm(skel.armNear)}
      {head}

      {cheer && (
        <g>
          <Star cx={r(skel.headCenter.x - 30)} cy={r(skel.headCenter.y - 6)} size={6.5} spin={sec * 90} />
          <Star cx={r(skel.headCenter.x + 30)} cy={r(skel.headCenter.y - 16)} size={5} spin={-sec * 120} />
          <Star cx={r(skel.headCenter.x + 26)} cy={r(skel.headCenter.y + 16)} size={3.8} spin={sec * 150} />
        </g>
      )}
    </g>
  );
}

/** Scene area that holds every demo pose at full size (the rig's 260×200 scene, cropped) */
export const MASCOT_VIEWBOX = { x: 40, y: -6, w: 180, h: 206 };

