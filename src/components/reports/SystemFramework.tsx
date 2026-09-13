/**
 * 学习力系统框架图（纯 Tailwind div 静态结构，打印友好，不依赖 SVG/图表库）。
 * 结构：顶部「学习目标 · 成绩」→ 三阶递进（乐学/会学/善学，绿/蓝/金，与九能雷达轴标一致）
 * → 底座两框（条件·支持系统 / 学能·能力系统，暖灰）。
 */
/** 三阶递进配置（低饱和底色 + 本色描边/标题）。 */
const TIERS: { name: string; sub: string; abilities: string[]; color: string; bg: string }[] = [
  { name: "乐学 · 动力系统", sub: "发动机 · 先解决「为什么学」", abilities: ["动力", "信心", "韧劲"], color: "#7cb83c", bg: "#f0f7dd" },
  { name: "会学 · 行为系统", sub: "底盘 · 跑顺日常学习闭环", abilities: ["学懂", "记住", "会用"], color: "#3d8ec4", bg: "#e3edf6" },
  { name: "善学 · 加速系统", sub: "加速器 · 策略与元认知", abilities: ["计划", "复盘", "智学"], color: "#c7a23a", bg: "#f5eecb" },
];

/** 底座两框（暖灰）。 */
const BASES: { name: string; sub: string; abilities: string[] }[] = [
  { name: "条件 · 支持系统", sub: "土壤 · 不进总分，干预第一优先", abilities: ["状态", "关系", "资源"] },
  { name: "学能 · 能力系统", sub: "加工效率 · 单独报告，不进总分", abilities: ["注意力", "工作记忆", "加工速度"] },
];

export default function SystemFramework() {
  return (
    <div className="rounded-xl border border-border bg-cream/60 p-4 sm:p-5">
      {/* 顶部：学习目标 */}
      <div className="mx-auto w-fit rounded-full bg-olive px-6 py-1.5 text-[13px] font-bold text-cream">
        学习目标 · 成绩
      </div>
      <div className="mx-auto my-1.5 h-3 w-px bg-olive-mute/50" />

      {/* 三阶递进 */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {TIERS.map((t, i) => (
          <div
            key={t.name}
            className="rounded-xl border px-3.5 py-3 text-center"
            style={{ borderColor: `${t.color}80`, background: t.bg }}
          >
            <div className="text-[13.5px] font-bold" style={{ color: t.color }}>
              {i + 1} 阶 · {t.name}
            </div>
            <div className="mt-0.5 text-[11px] text-olive-mute">{t.sub}</div>
            <div className="mt-2 flex justify-center gap-1.5">
              {t.abilities.map((a) => (
                <span
                  key={a}
                  className="rounded-md border bg-white/70 px-2 py-0.5 text-[12px] font-semibold text-olive"
                  style={{ borderColor: `${t.color}66` }}
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto my-1.5 h-3 w-px bg-olive-mute/50" />

      {/* 底座：条件 + 学能 */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {BASES.map((b) => (
          <div key={b.name} className="rounded-xl border border-[#a8b08c]/60 bg-[#eef0e4] px-3.5 py-3 text-center">
            <div className="text-[13.5px] font-bold text-[#6b7452]">{b.name}</div>
            <div className="mt-0.5 text-[11px] text-olive-mute">{b.sub}</div>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {b.abilities.map((a) => (
                <span key={a} className="rounded-md border border-[#a8b08c]/50 bg-white/70 px-2 py-0.5 text-[12px] font-semibold text-olive">
                  {a}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-center text-[11px] text-olive-mute">
        成绩长在三层系统之上，三层系统立在条件与学能的底座上——修学习力，从地基往上修。
      </p>
    </div>
  );
}
