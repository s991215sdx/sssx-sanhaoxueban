export function scoreColor(score: number) {
  if (score >= 80) return "#7cb83c";
  if (score >= 60) return "#cfe07a";
  if (score > 0) return "#cf6a3c";
  return "#d9dcb8";
}

export function scoreLabel(score: number) {
  if (score >= 80) return "已掌握";
  if (score >= 60) return "基本掌握";
  if (score > 0) return "需巩固";
  return "未开始";
}

/** 掌握度进度条 */
export function MasteryBar({ score, className = "" }: { score: number; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-secondary ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.max(score, 2)}%`, backgroundColor: scoreColor(score) }}
      />
    </div>
  );
}

/** 掌握度圆环 */
export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8e9c8" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="transition-all duration-700"
        />
      </svg>
      <span className="mono absolute inset-0 flex items-center justify-center text-[13px] font-bold text-olive">
        {score}
      </span>
    </div>
  );
}
