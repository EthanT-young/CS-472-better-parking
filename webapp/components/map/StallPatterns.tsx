// Fill patterns referenced by the stall polygons as url(#...).
export default function StallPatterns() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="stall-open" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#22c55e" />
        </pattern>
        <pattern
          id="stall-taken"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="5" height="5" fill="#64748b" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="#e2e8f0" strokeWidth="1.6" />
        </pattern>
        <pattern id="stall-open-hc" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#facc15" />
        </pattern>
        <pattern
          id="stall-taken-hc"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="5" height="5" fill="#000000" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="#ffffff" strokeWidth="1.4" />
        </pattern>
      </defs>
    </svg>
  );
}
