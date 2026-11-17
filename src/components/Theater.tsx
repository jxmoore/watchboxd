// A dim cinema drawn in SVG: velvet curtains and valance, a glowing screen, the projector beam, rows of seats.
// Purely decorative; it sits behind the header and fades into the page. The curtains and valance are their own
// SVGs pinned to the edges, so they stay in frame at any width while the room in the middle scales.

const W = 1440;
const H = 560;

// Dust motes in the beam
const motes = [
  [612, 520, 1.6], [690, 470, 1.1], [742, 430, 1.4], [668, 400, 0.9], [810, 455, 1.2],
  [760, 372, 1], [640, 452, 0.8], [858, 392, 1.3], [700, 350, 0.9], [905, 345, 1],
];

/** Velvet fill: repeating fold stripes, a top/bottom shadow, and screen light on one edge. */
function Velvet({ id, d, rimSide }: { id: string; d: string; rimSide: 'left' | 'right' | 'none' }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-folds`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="40" y2="0" spreadMethod="repeat">
          <stop offset="0" stopColor="#25090d" />
          <stop offset="0.42" stopColor="#47111a" />
          <stop offset="0.55" stopColor="#581620" />
          <stop offset="1" stopColor="#25090d" />
        </linearGradient>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c0b0d" stopOpacity="0.5" />
          <stop offset="0.45" stopColor="#0c0b0d" stopOpacity="0.12" />
          <stop offset="1" stopColor="#0c0b0d" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1={rimSide === 'left' ? '1' : '0'} y1="0" x2={rimSide === 'left' ? '0' : '1'} y2="0">
          <stop offset="0.5" stopColor="#ffb977" stopOpacity="0" />
          <stop offset="1" stopColor="#ffb977" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#${id}-folds)`} />
      <path d={d} fill={`url(#${id}-shade)`} />
      {rimSide !== 'none' && <path d={d} fill={`url(#${id}-rim)`} />}
    </>
  );
}

// Curtain shape in a 300×560 box, gathered toward the outer bottom corner.
const CURTAIN = 'M0,0 H300 C272,150 258,290 192,400 C158,458 108,520 36,560 H0 Z';

// Valance in a 1440×100 box with a scalloped bottom edge.
const SWAG = 120;
const VALANCE =
  'M0,0 H1440 V40 ' +
  Array.from({ length: 1440 / SWAG }, (_, i) => {
    const x = 1440 - i * SWAG;
    return `Q${x - SWAG / 2},96 ${x - SWAG},40`;
  }).join(' ') +
  ' Z';

export default function Theater() {
  return (
    <div className="theater" aria-hidden="true">
      <svg className="theater-room" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" focusable="false">
        <defs>
          <radialGradient id="th-screen" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#fff1dc" stopOpacity="0.5" />
            <stop offset="0.45" stopColor="#ffb977" stopOpacity="0.15" />
            <stop offset="1" stopColor="#ffb977" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="th-beam" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ffe2b8" stopOpacity="0.2" />
            <stop offset="1" stopColor="#ffe2b8" stopOpacity="0.03" />
          </linearGradient>
          <pattern id="th-seat" width="68" height="84" patternUnits="userSpaceOnUse">
            <path d="M8,84 V26 Q8,8 26,8 H42 Q60,8 60,26 V84 Z" fill="#0f0f12" />
            <path d="M12,22 Q14,12 26,12 H42 Q54,12 56,22" fill="none" stroke="#ffc58f" strokeOpacity="0.14" strokeWidth="1.5" />
          </pattern>
          <filter id="th-blur-lg" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="34" />
          </filter>
          <filter id="th-blur-sm">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id="th-blur-xs">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Screen and its glow */}
        <rect x="300" y="30" width="840" height="330" rx="20" fill="url(#th-screen)" filter="url(#th-blur-lg)" />
        <rect x="430" y="88" width="580" height="236" rx="10" fill="#efe2cf" opacity="0.04" filter="url(#th-blur-xs)" />

        {/* Projector beam from behind the audience */}
        <polygon points="676,600 764,600 1010,324 430,324" fill="url(#th-beam)" filter="url(#th-blur-sm)" />
        {motes.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#ffe7c4" opacity={0.25 + (i % 3) * 0.12} />
        ))}

        {/* Two rows of seats; the front row is larger and darker */}
        <rect x="0" y="452" width={W} height="108" fill="url(#th-seat)" opacity="0.85" />
        <rect x="-34" y="0" width={W + 68} height={H} fill="url(#th-seat)" transform="translate(0,500) scale(1.35)" />
      </svg>

      <svg className="theater-curtain left" viewBox="0 0 300 560" preserveAspectRatio="none" focusable="false">
        <Velvet id="th-cl" d={CURTAIN} rimSide="right" />
      </svg>
      <svg className="theater-curtain right" viewBox="0 0 300 560" preserveAspectRatio="none" focusable="false">
        <Velvet id="th-cr" d={CURTAIN} rimSide="right" />
      </svg>
      <svg className="theater-valance" viewBox="0 0 1440 100" preserveAspectRatio="none" focusable="false">
        <Velvet id="th-v" d={VALANCE} rimSide="none" />
      </svg>
    </div>
  );
}
