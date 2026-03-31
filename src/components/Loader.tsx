'use client'

export default function Loader({ size = 64 }: { size?: number }) {
  const circleR = size * 0.35
  const cx = size * 0.45
  const cy = size * 0.42
  const strokeW = size * 0.06
  const lineX1 = cx + circleR * 0.7
  const lineY1 = cy + circleR * 0.7
  const lineX2 = lineX1 + size * 0.15
  const lineY2 = lineY1 + size * 0.15
  const fontSize = size * 0.38

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ animation: 'loaderPulse 1.5s ease-in-out infinite' }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={circleR}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeW}
          opacity={0.8}
        />
        <line
          x1={lineX1}
          y1={lineY1}
          x2={lineX2}
          y2={lineY2}
          stroke="var(--accent)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          opacity={0.8}
        />
        <text
          x={cx}
          y={cy + fontSize * 0.33}
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontWeight="bold"
          fontSize={fontSize}
          fill="var(--accent)"
        >
          W
        </text>
      </svg>
    </div>
  )
}
