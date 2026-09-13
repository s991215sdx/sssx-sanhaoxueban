/**
 * 学习力系统框架图（纯 Tailwind div 静态结构，打印友好，不依赖 SVG/图表库）。
 * 结构：顶部「学习目标 · 成绩」→ 三阶递进（乐学/会学/善学，绿/蓝/金，与九能雷达轴标一致）
 * → 底座两框（条件·支持系统 / 学能·能力系统，暖灰）。
 * 可选 status：各节点下方渲染测评完成状态徽标（已测=绿底实线 chip，未测=灰虚线 chip）；
 * 不传 status 时完全不显示徽标，与静态图一致（零 props 向后兼容）。
 */
export type FrameworkStatus = {
  academics?: { filled: boolean; note?: string }; // 学习目标·成绩 节点
  e3?: { done: boolean; scores?: Record<"乐学" | "会学" | "善学", number>; conditionAvg?: number; aptitudeAvg?: number };
  mental?: { done: boolean; note?: string }; // 挂 条件·支持系统
  multi5?: { done: boolean; note?: string }; // 挂 学能·能力系统
  multi?: { done: boolean; note?: string }; // 多元八维自评，挂 学能·能力系统
  mbti?: { done: boolean; note?: string }; // 深层特质行
  disc?: { done: boolean; note?: string };
  holland?: { done: boolean; note?: string };
  anchor?: { done: boolean; note?: string };
};

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

/** 深层特质行四小框。 */
const DEEP_TRAITS: { key: "mbti" | "disc" | "holland" | "anchor"; label: string }[] = [
  { key: "mbti", label: "MBTI 性格" },
  { key: "disc", label: "DISC 行为" },
  { key: "holland", label: "霍兰德兴趣" },
  { key: "anchor", label: "职业锚" },
];

/** 状态徽标：done=绿底实线 chip；未完成=灰虚线 chip。 */
function StatusChip({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold leading-tight ${
        done
          ? "border border-[#7cb83c]/60 bg-[#e9f4d2] text-[#4e7d20]"
          : "border border-dashed border-[#a8b08c]/80 text-olive-mute"
      }`}
    >
      {label}
    </span>
  );
}

export default function SystemFramework({ status }: { status?: FrameworkStatus }) {
  const tierKey = (name: string) => name.split(" ")[0] as "乐学" | "会学" | "善学";
  const showDeep = !!(status?.mbti || status?.disc || status?.holland || status?.anchor);
  return (
    <div className="rounded-xl border border-border bg-cream/60 p-4 sm:p-5">
      {/* 顶部：学习目标 */}
      <div className="mx-auto w-fit rounded-full bg-olive px-6 py-1.5 text-[13px] font-bold text-cream">
        学习目标 · 成绩
      </div>
      {status?.academics && (
        <div className="mt-1.5 text-center">
          <StatusChip
            done={status.academics.filled}
            label={
              status.academics.filled
                ? `成绩与目标 · 已填${status.academics.note ? ` · ${status.academics.note}` : ""}`
                : "成绩与目标 · 未填"
            }
          />
        </div>
      )}
      <div className="mx-auto my-1.5 h-3 w-px bg-olive-mute/50" />

      {/* 三阶递进 */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {TIERS.map((t, i) => {
          const score = status?.e3?.done ? status.e3.scores?.[tierKey(t.name)] : undefined;
          return (
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
              {status?.e3 && (
                <div className="mt-2">
                  <StatusChip
                    done={status.e3.done && score != null}
                    label={
                      status.e3.done && score != null
                        ? `学业诊断 · ${tierKey(t.name)} ${score}/5`
                        : "学业诊断 · 未测"
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
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
            {/* 条件·支持系统：E3（条件均分）+ 心理健康徽标 */}
            {b.name.startsWith("条件") && (status?.e3 || status?.mental) && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {status?.e3 && (
                  <StatusChip
                    done={status.e3.done && status.e3.conditionAvg != null}
                    label={
                      status.e3.done && status.e3.conditionAvg != null
                        ? `学业诊断 · 条件 ${status.e3.conditionAvg}/5`
                        : "学业诊断 · 未测"
                    }
                  />
                )}
                {status?.mental && (
                  <StatusChip
                    done={status.mental.done}
                    label={status.mental.done ? `心理健康 · ${status.mental.note ?? "已测"}` : "心理健康 · 未测"}
                  />
                )}
              </div>
            )}
            {/* 学能·能力系统：E3（学能均分）+ 多元智能五项 + 多元智能八维自评徽标 */}
            {b.name.startsWith("学能") && (status?.e3 || status?.multi5 || status?.multi) && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {status?.e3 && (
                  <StatusChip
                    done={status.e3.done && status.e3.aptitudeAvg != null}
                    label={
                      status.e3.done && status.e3.aptitudeAvg != null
                        ? `学业诊断 · 学能 ${status.e3.aptitudeAvg}/5`
                        : "学业诊断 · 未测"
                    }
                  />
                )}
                {status?.multi5 && (
                  <StatusChip
                    done={status.multi5.done}
                    label={status.multi5.done ? `多元五项 · ${status.multi5.note ?? "已测"}` : "多元智能五项 · 未测"}
                  />
                )}
                {status?.multi && (
                  <StatusChip
                    done={status.multi.done}
                    label={status.multi.done ? `多元八维 · ${status.multi.note ?? "已测"}` : "多元智能八维 · 未测"}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 深层特质行：性格与方向的长期底色（仅 status 提供时显示） */}
      {showDeep && (
        <>
          <div className="mx-auto my-1.5 h-3 w-px bg-olive-mute/50" />
          <div className="rounded-xl border border-[#a8b08c]/60 bg-[#eef0e4] px-3.5 py-3">
            <div className="text-center text-[12.5px] font-bold text-[#6b7452]">深层特质 · 性格与方向的长期底色</div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DEEP_TRAITS.map((d) => {
                const st = status?.[d.key];
                return (
                  <div key={d.key} className="rounded-lg border border-[#a8b08c]/50 bg-white/70 px-2 py-1.5 text-center">
                    <div className="text-[11px] font-semibold text-olive">{d.label}</div>
                    <div className="mt-1">
                      <StatusChip done={!!st?.done} label={st?.done ? (st.note ?? "已测") : "未测"} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      <p className="mt-2.5 text-center text-[11px] text-olive-mute">
        成绩长在三层系统之上，三层系统立在条件与学能的底座上——修学习力，从地基往上修。
      </p>
    </div>
  );
}
