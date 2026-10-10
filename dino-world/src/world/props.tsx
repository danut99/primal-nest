// Piese mici de decor (copaci, stânci, tufe), folosite în arta clădirilor.

export function Tree() {
  return (
    <g>
      <path d="M-6,2 L-4,-40 L4,-40 L7,2 Z" fill="#6d4c33" />
      <path d="M-2,-30 L-16,-48 M2,-34 L14,-52" stroke="#6d4c33" strokeWidth={4} strokeLinecap="round" />
      <circle cx={-18} cy={-58} r={22} fill="#2e7d32" />
      <circle cx={18} cy={-60} r={24} fill="#388e3c" />
      <circle cx={0} cy={-80} r={27} fill="#43a047" />
      <circle cx={-8} cy={-88} r={12} fill="#66bb6a" />
      <circle cx={14} cy={-70} r={9} fill="#5cb85c" opacity={0.8} />
    </g>
  );
}

export function Pine() {
  return (
    <g>
      <rect x={-4} y={-14} width={8} height={16} fill="#5d4037" />
      <path d="M-28,-12 L0,-50 L28,-12 Z" fill="#1b5e20" />
      <path d="M-22,-36 L0,-72 L22,-36 Z" fill="#2e7d32" />
      <path d="M-15,-58 L0,-92 L15,-58 Z" fill="#388e3c" />
      <path d="M0,-92 L15,-58 L4,-58 Z" fill="#1b5e20" opacity={0.4} />
    </g>
  );
}

export function Rock() {
  return (
    <g>
      <path d="M-30,2 L-24,-20 L-6,-34 L16,-28 L30,-8 L26,4 Z" fill="#8a8f98" />
      <path d="M-24,-20 L-6,-34 L16,-28 L4,-14 Z" fill="#b8bec7" />
      <path d="M16,-28 L30,-8 L26,4 L8,-6 Z" fill="#6b7079" />
    </g>
  );
}

export function Bush() {
  return (
    <g>
      <circle cx={-12} cy={-10} r={13} fill="#2e7d32" />
      <circle cx={10} cy={-10} r={14} fill="#388e3c" />
      <circle cx={0} cy={-20} r={14} fill="#4caf50" />
      <circle cx={-4} cy={-24} r={5} fill="#81c784" />
      <circle cx={8} cy={-14} r={3} fill="#ff8fab" />
    </g>
  );
}

export function Mushroom() {
  return (
    <g>
      <rect x={-5} y={-30} width={10} height={32} rx={4} fill="#f3e5c0" />
      <ellipse cx={0} cy={-32} rx={26} ry={14} fill="#ff9800" />
      <ellipse cx={0} cy={-36} rx={20} ry={9} fill="#ffb74d" />
      <circle cx={-9} cy={-36} r={3} fill="#fff3e0" />
      <circle cx={8} cy={-38} r={4} fill="#fff3e0" />
      <rect x={18} y={-14} width={6} height={16} rx={3} fill="#f3e5c0" />
      <ellipse cx={21} cy={-15} rx={13} ry={7} fill="#fb8c00" />
    </g>
  );
}
