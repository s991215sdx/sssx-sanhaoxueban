/**
 * 学习力系统框架图（纯 Tailwind div 静态结构，打印友好，不依赖 SVG/图表库）。
 * 结构：顶部「学习目标 · 成绩」→ 三阶递进（乐学/会学/善学，绿/蓝/金，与九能雷达轴标一致）
 * → 底座两框（条件·支持系统 / 学能·能力系统，暖灰）→ 深层特质行（MBTI/DISC/霍兰德/职业锚）。
 *
 * V36：
 * - 已测评节点为纯静态展示（不再链接到图形与图表）；未测评徽章仍可点击直达对应测评，
 *   成绩未填仍可点击去填写（onOpen 仅这两种动作）。
 * - 一级单元只展示能力名 + 均分（不再渲染二级考察点小 chip），保持框架清爽。
 * - 不传 status / onOpen 时退化为纯静态图（零 props 向后兼容）。
 * V51：多元智能八维自评已下线，框架中不再出现「多元智能八维」徽标。
 */
import { E3V37_LEVEL_STYLE } from "./e3v37Theme";
import type { E3V37Level } from "./e3v37Theme";

/** 节点点击行为：assess=去测评（未测节点）；fill-academics=去填成绩（未填节点）。 */
export type FrameworkLink = { kind: "assess"; start: string } | { kind: "fill-academics" };

/** 一级单元（能力/条件格/学能项）：只保留均分（二级考察点不再上框架图）。 */
export type FrameworkUnit = { score?: number; level?: E3V37Level };

export type FrameworkStatus = {
  academics?: {
    filled: boolean;
    note?: string;
    /** 二级考察点：各科 现状→目标。 */
    subjects?: { name: string; last?: number | null; target?: number | null }[];
  };
  e3?: {
    done: boolean;
    scores?: Record<"乐学" | "会学" | "善学", number>;
    conditionAvg?: number;
    aptitudeAvg?: number;
    /** 一级数据，key=能力名（动力…）或条件格（状态/关系/资源）或学能项（注意力/工作记忆/加工速度）。 */
    units?: Record<string, FrameworkUnit>;
  };
  mental?: { done: boolean; note?: string };
  multi5?: { done: boolean; note?: string; subs?: string[] }; // 五项维度分
  mbti?: { done: boolean; note?: string; subs?: string[] };
  disc?: { done: boolean; note?: string; subs?: string[] };
  holland?: { done: boolean; note?: string; subs?: string[] };
  anchor?: { done: boolean; note?: string; subs?: string[] };
};

/** 三阶递进配置（低饱和底色 + 本色描边/标题）。 */
const TIERS: { name: string; key: "乐学" | "会学" | "善学"; sub: string; abilities: string[]; color: string; bg: string }[] = [
  { name: "乐学 · 动力系统", key: "乐学", sub: "发动机 · 先解决「为什么学」", abilities: ["动力", "信心", "韧劲"], color: "#7cb83c", bg: "#f0f7dd" },
  { name: "会学 · 行为系统", key: "会学", sub: "底盘 · 跑顺日常学习闭环", abilities: ["学懂", "记住", "会用"], color: "#3d8ec4", bg: "#e3edf6" },
  { name: "善学 · 加速系统", key: "善学", sub: "加速器 · 策略与元认知", abilities: ["计划", "复盘", "智学"], color: "#c7a23a", bg: "#f5eecb" },
];

/** 底座两框（暖灰）。 */
const BASES: { name: string; key: "条件" | "学能"; sub: string; abilities: string[] }[] = [
  { name: "条件 · 支持系统", key: "条件", sub: "土壤 · 不进总分，干预第一优先", abilities: ["状态", "关系", "资源"] },
  { name: "学能 · 能力系统", key: "学能", sub: "加工效率 · 单独报告，不进总分", abilities: ["注意力", "工作记忆", "加工速度"] },
];

/** 深层特质行四小框。 */
const DEEP_TRAITS: { key: "mbti" | "disc" | "holland" | "anchor"; label: string }[] = [
  { key: "mbti", label: "MBTI 性格" },
  { key: "disc", label: "DISC 行为" },
  { key: "holland", label: "霍兰德兴趣" },
  { key: "anchor", label: "职业锚" },
];

/** 状态徽标：done=绿底实线（纯展示）；未完成=灰虚线，给了 onClick 时可点击（去测评/去填）。 */
function LinkChip({ done, label, onClick }: { done: boolean; label: string; onClick?: () => void }) {
  const cls = `inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold leading-tight ${
    done
      ? "border border-[#7cb83c]/60 bg-[#e9f4d2] text-[#4e7d20]"
      : "border border-dashed border-[#a8b08c]/80 text-olive-mute"
  }`;
  if (!onClick) return <span className={cls}>{label}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      title="点击直达对应测评/填写"
      className={`${cls} cursor-pointer transition hover:shadow-sm hover:brightness-95`}
    >
      {label}
      <span className="ml-0.5 opacity-70">→</span>
    </button>
  );
}

/** 分数档判定（与 V3.7 全局口径一致）：红 <3.0 卡点；黄 3.0–3.7 待提升；绿 ≥3.8 正常。 */
export function frameworkScoreLevel(score: number): E3V37Level {
  if (score < 3.0) return "卡点";
  if (score < 3.8) return "待提升";
  return "正常";
}

/** 系统均分徽标：按分数红黄绿着色，格式「乐学 3.8/5 · 正常」（不再带「学业诊断 ·」前缀）。 */
function ScoreChip({ name, score }: { name: string; score: number }) {
  const lv = frameworkScoreLevel(score);
  const st = E3V37_LEVEL_STYLE[lv];
  return (
    <span
      className="inline-block rounded-full border px-2 py-0.5 text-[10.5px] font-semibold leading-tight"
      style={{ borderColor: `${st.bar}99`, color: st.text, background: st.bg }}
    >
      {name} {score}/5 · {lv}
    </span>
  );
}

/** 一级单元块：能力名 + 均分（有色），不带二级考察点；纯静态展示。 */
function UnitBlock({ name, unit, done }: { name: string; unit?: FrameworkUnit; done: boolean }) {
  const lv: E3V37Level = unit?.level ?? (done ? "正常" : "待提升");
  const st = E3V37_LEVEL_STYLE[lv];
  return (
    <div className="rounded-lg border border-[#a8b08c]/40 bg-white/70 px-1.5 py-1 text-center">
      <div className="flex items-baseline justify-center gap-1">
        <span className="text-[12px] font-semibold text-olive">{name}</span>
        {done && unit?.score != null && (
          <span className="mono text-[11.5px] font-bold" style={{ color: st.text }}>
            {unit.score}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SystemFramework({
  status,
  onOpen,
}: {
  status?: FrameworkStatus;
  onOpen?: (link: FrameworkLink) => void;
}) {
  const open = (l: FrameworkLink) => onOpen?.(l);
  const e3Done = !!status?.e3?.done;
  const assessE3 = onOpen ? () => open({ kind: "assess", start: "e3" }) : undefined;
  const unitOf = (label: string): FrameworkUnit | undefined => status?.e3?.units?.[label];
  const showDeep = !!(status?.mbti || status?.disc || status?.holland || status?.anchor);
  return (
    <div className="rounded-xl border border-border bg-cream/60 p-4 sm:p-5">
      {/* 顶部：学习目标 · 成绩（冰山上） */}
      <div className="mx-auto w-fit rounded-full bg-olive px-6 py-1.5 text-[13px] font-bold text-cream">
        学习目标 · 成绩
      </div>
      {status?.academics && (
        <div className="mt-1.5 text-center">
          <LinkChip
            done={status.academics.filled}
            label={
              status.academics.filled
                ? `成绩与目标 · 已填${status.academics.note ? ` · ${status.academics.note}` : ""}`
                : "成绩与目标 · 未填写"
            }
            onClick={!status.academics.filled && onOpen ? () => open({ kind: "fill-academics" }) : undefined}
          />
        </div>
      )}
      <div className="mx-auto my-1.5 h-3 w-px bg-olive-mute/50" />

      {/* 三阶递进（每阶：三能 + 各能的二级考察点） */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {TIERS.map((t, i) => {
          const score = e3Done ? status?.e3?.scores?.[t.key] : undefined;
          return (
            <div
              key={t.name}
              className="rounded-xl border px-3 py-3 text-center"
              style={{ borderColor: `${t.color}80`, background: t.bg }}
            >
              <div className="text-[13.5px] font-bold" style={{ color: t.color }}>
                {i + 1} 阶 · {t.name}
              </div>
              <div className="mt-0.5 text-[11px] text-olive-mute">{t.sub}</div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {t.abilities.map((a) => (
                  <UnitBlock key={a} name={a} unit={unitOf(a)} done={e3Done} />
                ))}
              </div>
              {status?.e3 && (
                <div className="mt-2">
                  {e3Done && score != null ? (
                    <ScoreChip name={t.key} score={score} />
                  ) : (
                    <LinkChip done={false} label="学业诊断 · 未测" onClick={assessE3} />
                  )}
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
          <div key={b.name} className="rounded-xl border border-[#a8b08c]/60 bg-[#eef0e4] px-3 py-3 text-center">
            <div className="text-[13.5px] font-bold text-[#6b7452]">{b.name}</div>
            <div className="mt-0.5 text-[11px] text-olive-mute">{b.sub}</div>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {b.abilities.map((a) => (
                <UnitBlock key={a} name={a} unit={unitOf(a)} done={e3Done} />
              ))}
            </div>
            {/* 条件·支持系统：E3（条件均分）+ 心理健康徽标 */}
            {b.key === "条件" && (status?.e3 || status?.mental) && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {status?.e3 &&
                  (e3Done && status.e3.conditionAvg != null ? (
                    <ScoreChip name="条件" score={status.e3.conditionAvg} />
                  ) : (
                    <LinkChip done={false} label="学业诊断 · 未测" onClick={assessE3} />
                  ))}
                {status?.mental && (
                  <LinkChip
                    done={status.mental.done}
                    label={status.mental.done ? `心理健康 · ${status.mental.note ?? "已测"}` : "心理健康 · 未测"}
                    onClick={!status.mental.done && onOpen ? () => open({ kind: "assess", start: "mental" }) : undefined}
                  />
                )}
              </div>
            )}
            {/* 学能·能力系统：E3（学能均分）+ 多元智能五项徽标（八维自评已下线，不再展示） */}
            {b.key === "学能" && (status?.e3 || status?.multi5) && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {status?.e3 &&
                  (e3Done && status.e3.aptitudeAvg != null ? (
                    <ScoreChip name="学能" score={status.e3.aptitudeAvg} />
                  ) : (
                    <LinkChip done={false} label="学业诊断 · 未测" onClick={assessE3} />
                  ))}
                {status?.multi5 && (
                  <LinkChip
                    done={status.multi5.done}
                    label={status.multi5.done ? `多元五项 · ${status.multi5.note ?? "已测"}` : "多元智能五项 · 未测"}
                    onClick={!status.multi5.done && onOpen ? () => open({ kind: "assess", start: "multi5" }) : undefined}
                  />
                )}
              </div>
            )}
            {/* 多元五项二级考察点：五个维度分 */}
            {b.key === "学能" && status?.multi5?.done && (status.multi5.subs?.length ?? 0) > 0 && (
              <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                {status.multi5.subs!.map((s) => (
                  <span key={s} className="rounded border border-border bg-white/70 px-1.5 py-px text-[10px] leading-tight text-olive-soft">
                    {s}
                  </span>
                ))}
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
                const box = (
                  <>
                    <div className="text-[11px] font-semibold text-olive">{d.label}</div>
                    <div className="mt-1">
                      <LinkChip
                        done={!!st?.done}
                        label={st?.done ? (st.note ?? "已测") : "未测"}
                        onClick={!st?.done && onOpen ? () => open({ kind: "assess", start: d.key }) : undefined}
                      />
                    </div>
                    {st?.done && (st.subs?.length ?? 0) > 0 && (
                      <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                        {st.subs!.map((s) => (
                          <span key={s} className="rounded bg-cream px-1 py-px text-[9.5px] leading-tight text-olive-mute">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                );
                return (
                  <div key={d.key} className="rounded-lg border border-[#a8b08c]/50 bg-white/70 px-2 py-1.5 text-center">
                    {box}
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
      {onOpen && (
        <p className="mt-1 text-center text-[10.5px] text-olive-mute">
          灰虚线徽章可直接点击开始测评；红 &lt;3.0 卡点 · 黄 3.0-3.7 待提升 · 绿 ≥3.8 正常。
        </p>
      )}
    </div>
  );
}
