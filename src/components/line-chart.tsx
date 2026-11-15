type Point = { at: Date; value: number };

export function LineChart({
  points,
  unit,
  height = 160,
}: {
  points: Point[];
  unit: string;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <p className="muted">
        Для графика нужно минимум два измерения.
      </p>
    );
  }

  const width = 720;
  const padX = 12;
  const padY = 18;

  const sorted = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
  const times = sorted.map((p) => p.at.getTime());
  const values = sorted.map((p) => p.value);

  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);

  const spanT = maxT - minT || 1;
  const padV = (maxV - minV) * 0.15 || Math.max(1, maxV * 0.05);
  const lo = minV - padV;
  const hi = maxV + padV;
  const spanV = hi - lo || 1;

  const x = (t: number) =>
    padX + ((t - minT) / spanT) * (width - padX * 2);
  const y = (v: number) =>
    height - padY - ((v - lo) / spanV) * (height - padY * 2);

  const line = sorted.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.at.getTime()).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(maxT).toFixed(1)},${height - padY} L${x(minT).toFixed(1)},${height - padY} Z`;

  const fmt = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={`Динамика, ${unit}`}
    >
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>

      <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="#1b2733" />
      <path d={area} fill="url(#chartFill)" />
      <path d={line} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" />

      {sorted.map((p, i) => (
        <circle
          key={i}
          cx={x(p.at.getTime())}
          cy={y(p.value)}
          r="3"
          fill="#070b0f"
          stroke="#22d3ee"
          strokeWidth="2"
        >
          <title>{`${p.at.toLocaleDateString("ru-RU")}: ${fmt(p.value)} ${unit}`}</title>
        </circle>
      ))}

      <text x={padX} y={12} fill="#94a3b8" fontSize="11">
        макс {fmt(hi)}
      </text>
      <text x={padX} y={height - 4} fill="#94a3b8" fontSize="11">
        мин {fmt(lo)}
      </text>
    </svg>
  );
}
