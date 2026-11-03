'use client';

// "น้องยืด" — the kids UI mascot. Placeholder vector drawing until the final
// art lands in public/kids/mascot/ (spec: docs/KIDS-ART-UI.md §3 and §10).

export type MascotMood = 'happy' | 'cheer' | 'stretch' | 'sleepy' | 'think';

const INK = '#3B2A4A';
const BODY = '#FF9F5A';
const BELLY = '#FFE7C7';
const CHEEK = '#FF7A9A';

export function Mascot({
  mood = 'happy',
  size = 120,
  className = '',
}: {
  mood?: MascotMood;
  size?: number;
  className?: string;
}) {
  // "stretch" makes the body taller; everything else hangs off these numbers
  const stretch = mood === 'stretch';
  const top = stretch ? 46 : 70;
  const bodyRy = stretch ? 88 : 72;
  const cy = top + bodyRy;
  const eyeY = top + 52;

  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="น้องยืด"
    >
      <g stroke={INK} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
        {/* Arms */}
        {mood === 'cheer' || stretch ? (
          <>
            <path d={`M70 ${cy - 30} Q50 ${cy - 80} 60 ${top - 10}`} fill="none" />
            <path d={`M170 ${cy - 30} Q190 ${cy - 80} 180 ${top - 10}`} fill="none" />
          </>
        ) : mood === 'happy' ? (
          <>
            <path d={`M62 ${cy} Q40 ${cy + 10} 42 ${cy + 30}`} fill="none" />
            <path d={`M178 ${cy - 10} Q205 ${cy - 30} 200 ${cy - 60}`} fill="none" />
          </>
        ) : mood === 'think' ? (
          <>
            <path d={`M62 ${cy} Q40 ${cy + 10} 42 ${cy + 30}`} fill="none" />
            <path d={`M176 ${cy} Q170 ${cy - 20} 150 ${eyeY + 32}`} fill="none" />
          </>
        ) : (
          <>
            <path d={`M62 ${cy} Q48 ${cy + 20} 56 ${cy + 36}`} fill="none" />
            <path d={`M178 ${cy} Q192 ${cy + 20} 184 ${cy + 36}`} fill="none" />
          </>
        )}

        {/* Feet */}
        <ellipse cx={95} cy={cy + bodyRy - 4} rx={18} ry={10} fill={BODY} />
        <ellipse cx={145} cy={cy + bodyRy - 4} rx={18} ry={10} fill={BODY} />

        {/* Body */}
        <ellipse cx={120} cy={cy} rx={66} ry={bodyRy} fill={BODY} />
        <ellipse cx={120} cy={cy + bodyRy * 0.35} rx={40} ry={bodyRy * 0.45} fill={BELLY} strokeWidth={0} />
      </g>

      {/* Cheeks */}
      <ellipse cx={84} cy={eyeY + 20} rx={10} ry={6} fill={CHEEK} opacity={0.7} />
      <ellipse cx={156} cy={eyeY + 20} rx={10} ry={6} fill={CHEEK} opacity={0.7} />

      {/* Eyes */}
      {mood === 'cheer' ? (
        <g stroke={INK} strokeWidth={6} strokeLinecap="round" fill="none">
          <path d={`M90 ${eyeY + 4} L98 ${eyeY - 6} L106 ${eyeY + 4}`} />
          <path d={`M134 ${eyeY + 4} L142 ${eyeY - 6} L150 ${eyeY + 4}`} />
        </g>
      ) : mood === 'sleepy' ? (
        <g stroke={INK} strokeWidth={6} strokeLinecap="round" fill="none">
          <path d={`M88 ${eyeY} Q98 ${eyeY + 8} 108 ${eyeY}`} />
          <path d={`M132 ${eyeY} Q142 ${eyeY + 8} 152 ${eyeY}`} />
        </g>
      ) : (
        <g>
          <ellipse cx={98} cy={eyeY} rx={9} ry={11} fill={INK} />
          <ellipse cx={142} cy={eyeY} rx={9} ry={11} fill={INK} />
          <circle cx={101} cy={eyeY - 4} r={3.5} fill="#fff" />
          <circle cx={145} cy={eyeY - 4} r={3.5} fill="#fff" />
        </g>
      )}

      {/* Mouth */}
      <g stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none">
        {mood === 'cheer' ? (
          <path d={`M106 ${eyeY + 22} Q120 ${eyeY + 42} 134 ${eyeY + 22} Z`} fill={INK} />
        ) : mood === 'sleepy' ? (
          <ellipse cx={120} cy={eyeY + 26} rx={5} ry={4} />
        ) : mood === 'think' ? (
          <path d={`M110 ${eyeY + 26} L130 ${eyeY + 24}`} />
        ) : (
          <path d={`M108 ${eyeY + 22} Q120 ${eyeY + 34} 132 ${eyeY + 22}`} />
        )}
      </g>

      {/* Extras */}
      {mood === 'sleepy' && (
        <g fill={INK} fontFamily="var(--font-mali), sans-serif" fontWeight={700}>
          <text x={180} y={60} fontSize={26}>z</text>
          <text x={200} y={36} fontSize={20}>z</text>
        </g>
      )}
      {mood === 'think' && (
        <text x={186} y={62} fontSize={40} fontWeight={700} fill="#9B7BEA" fontFamily="var(--font-mali), sans-serif">
          ?
        </text>
      )}
      {mood === 'cheer' && (
        <g fill="#FFC93C" stroke={INK} strokeWidth={3} strokeLinejoin="round">
          <Star cx={30} cy={60} r={14} />
          <Star cx={212} cy={86} r={11} />
        </g>
      )}
    </svg>
  );
}

function Star({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
  }).join(' ');
  return <polygon points={pts} />;
}

// Mascot with a speech bubble: the main way the UI talks to the child
export function MascotSays({
  mood,
  children,
  size = 110,
}: {
  mood?: MascotMood;
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <div className="flex items-end gap-3">
      <Mascot mood={mood} size={size} className="kids-bob shrink-0" />
      <div className="relative mb-6 rounded-[24px] border-2 border-[var(--border)] bg-white px-4 py-3 text-lg font-bold leading-snug shadow-[0_4px_0_rgba(59,42,74,0.08)]">
        <span
          aria-hidden
          className="absolute -left-2.5 bottom-4 h-4 w-4 rotate-45 border-b-2 border-l-2 border-[var(--border)] bg-white"
        />
        {children}
      </div>
    </div>
  );
}
