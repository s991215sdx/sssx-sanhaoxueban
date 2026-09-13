/**
 * 学习力系统框架图（纯 Tailwind div 静态结构，打印友好，不依赖 SVG/图表库）。
 * 结构：顶部「学习目标 · 成绩」→ 三阶递进（乐学/会学/善学，绿/蓝/金，与九能雷达轴标一致）
 * → 底座两框（条件·支持系统 / 学能·能力系统，暖灰）→ 深层特质行（MBTI/DISC/霍兰德/职业锚）。
 *
 * V35：
 * - 每个节点带链接：已测评 → onOpen({kind:"tab"}) 去看对应模块的图形与图表；
 *   未测评 → onOpen({kind:"assess"}) 直达对应测评；成绩未填 → onOpen({kind:"fill-academics"})。
 * - 每个部分排出对应的二级考察点（能力 → 关注点 kp，带红黄绿分数小 chip；深层特质 → 各维度分）。
 * - 不传 status / onOpen 时退化为纯静态图（零 props 向后兼容）。
 */
import { E3V37_LEVEL_STYLE } from "./e3v37Theme";
import type { E3V37Level } from "./e3v37Theme";

/** 节点点击行为：tab=看模块图表；assess=去测评；fill-academics=去填成绩。 */
export type FrameworkLink =
  | { kind: "tab"; tab: string }
  | { kind: "assess"; start: string }
  | { kind: "fill-academics" };

/** 二级考察点（关注点 kp）：名称 + 均分 + 三档。 */
export type FrameworkFocus = { kp: string; score: number; level: E3V37Level };

/** 一级单元（能力/条件格/学能项）：均分 + 二级考察点列表。 */
export type FrameworkUnit = { score?: number; level?: E3V37Level; focuses?: FrameworkFocus[] };

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
    /** 一级/二级数据，key=能力名（动力…）或条件格（状态/关系/资源）或学能项（注意力/工作记忆/加工速度）。 */
    units?: Record<string, FrameworkUnit>;
  };
  mental?: { done: boolean; note?: string };
  multi5?: { done: boolean; note?: string; subs?: string[] }; // 五项维度分
  multi?: { done: boolean; note?: string }; // 多元八维自评（已下线，仅展示历史结果）
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
const DEEP_TRAITS: { key: "mbti" | "disc" | "holland" | "anchor"; label: string; tab: string }[] = [
  { key: "mbti", label: "MBTI 性格", tab: "mbti" },
  { key: "disc", label: "DISC 行为", tab: "disc" },
  { key: "holland", label: "霍兰德兴趣", tab: "holland" },
  { key: "anchor", label: "职业锚", tab: "anchor" },
];

/** 可点击的状态徽标按钮：done=绿底实线（去看图表）；未完成=灰虚线（去测评/去填）。 */
function LinkChip({
  done,
  label,
  onClick,
}: {
  done: boolean;
  label: string;
  onClick?: () => void;
}) {
  const cls = `inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold leading-tight transition ${
    done
      ? "border border-[#7cb83c]/60 bg-[#e9f4d2] text-[#4e7d20]"
      : "border border-dashed border-[#a8b08c]/80 text-olive-mute"
  }`;
  if (!onClick) return <span className={cls}>{label}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      title={done ? "点击查看对应模块的图形与图表" : "点击直达对应测评/填写"}
      className={`${cls} cursor-pointer hover:shadow-sm hover:brightness-95`}
    >
      {label}
      <span className="ml-0.5 opacity-70">→</span>
    </button>
  );
}

/** 二级考察点小 chip：按红黄绿阈值着色（描边 + 浅底）。 */
function FocusDot({ f }: { f: FrameworkFocus }) {
  const st = E3V37_LEVEL_STYLE[f.level];
  return (
    <span
      className="inline-block rounded border px-1 py-px text-[10px] leading-tight"
      style={{ borderColor: `${st.bar}55`, color: st.text, background: st.bg }}
    >
      {f.kp} {f.score}
    </span>
  );
}

/** 一级单元块：能力名 + 均分（有色）+ 二级考察点；可点击（已测→看图表）。 */
function UnitBlock({
  name,
  unit,
  done,
  onClick,
}: {
  name: string;
  unit?: FrameworkUnit;
  done: boolean;
  onClick?: () => void;
}) {
  const lv: E3V37Level = unit?.level ?? (done ? "正常" : "待提升");
  const st = E3V37_LEVEL_STYLE[lv];
  const inner = (
    <>
      <div className="flex items-baseline justify-center gap-1">
        <span className="text-[12px] font-semibold text-olive">{name}</span>
        {done && unit?.score != null && (
          <span className="mono text-[11.5px] font-bold" style={{ color: st.text }}>
            {unit.score}
          </span>
        )}
      </div>
      {done && unit?.focuses && unit.focuses.length > 0 && (
        <div className="mt-1 flex flex-wrap justify-center gap-0.5">
          {unit.focuses.map((f) => (
            <FocusDot key={f.kp} f={f} />
          ))}
        </div>
      )}
    </>
  );
  const cls = "rounded-lg border border-[#a8b08c]/40 bg-white/70 px-1.5 py-1 text-center";
  if (!onClick) return <div className={cls}>{inner}</div>;
  return (
    <button type="button" onClick={onClick} className={`${cls} cursor-pointer transition hover:border-lime hover:bg-lime-pale/40`}>
      {inner}
    </button>
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
  const e3Link = (): FrameworkLink => (e3Done ? { kind: "tab", tab: "e3" } : { kind: "assess", start: "e3" });
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
            onClick={
              onOpen
                ? () =>
                    open(
                      status.academics!.filled ? { kind: "tab", tab: "academics" } : { kind: "fill-academics" },
                    )
                : undefined
            }
          />
          {/* 二级考察点：各科 现状→目标 */}
          {status.academics.filled && (status.academics.subjects?.length ?? 0) > 0 && (
            <div className="mt-1.5 flex flex-wrap justify-center gap-1">
              {status.academics.subjects!.map((s) => (
                <span
                  key={s.name}
                  className="rounded border border-border bg-white/70 px-1.5 py-px text-[10.5px] leading-tight text-olive-soft"
                >
                  {s.name} {s.last ?? "—"}→{s.target ?? "—"}
                </span>
              ))}
            </div>
          )}
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
                  <UnitBlock
                    key={a}
                    name={a}
                    unit={unitOf(a)}
                    done={e3Done}
                    onClick={onOpen ? () => open(e3Link()) : undefined}
                  />
                ))}
              </div>
              {status?.e3 && (
                <div className="mt-2">
                  <LinkChip
                    done={e3Done && score != null}
                    label={e3Done && score != null ? `学业诊断 · ${t.key} ${score}/5` : "学业诊断 · 未测"}
                    onClick={onOpen ? () => open(e3Link()) : undefined}
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
          <div key={b.name} className="rounded-xl border border-[#a8b08c]/60 bg-[#eef0e4] px-3 py-3 text-center">
            <div className="text-[13.5px] font-bold text-[#6b7452]">{b.name}</div>
            <div className="mt-0.5 text-[11px] text-olive-mute">{b.sub}</div>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {b.abilities.map((a) => (
                <UnitBlock
                  key={a}
                  name={a}
                  unit={unitOf(a)}
                  done={e3Done}
                  onClick={onOpen ? () => open(e3Link()) : undefined}
                />
              ))}
            </div>
            {/* 条件·支持系统：E3（条件均分）+ 心理健康徽标 */}
            {b.key === "条件" && (status?.e3 || status?.mental) && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {status?.e3 && (
                  <LinkChip
                    done={e3Done && status.e3.conditionAvg != null}
                    label={e3Done && status.e3.conditionAvg != null ? `学业诊断 · 条件 ${status.e3.conditionAvg}/5` : "学业诊断 · 未测"}
                    onClick={onOpen ? () => open(e3Link()) : undefined}
                  />
                )}
                {status?.mental && (
                  <LinkChip
                    done={status.mental.done}
                    label={status.mental.done ? `心理健康 · ${status.mental.note ?? "已测"}` : "心理健康 · 未测"}
                    onClick={
                      onOpen
                        ? () => open(status.mental!.done ? { kind: "tab", tab: "mental" } : { kind: "assess", start: "mental" })
                        : undefined
                    }
                  />
                )}
              </div>
            )}
            {/* 学能·能力系统：E3（学能均分）+ 多元智能五项 + 多元智能八维自评徽标 */}
            {b.key === "学能" && (status?.e3 || status?.multi5 || status?.multi) && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {status?.e3 && (
                  <LinkChip
                    done={e3Done && status.e3.aptitudeAvg != null}
                    label={e3Done && status.e3.aptitudeAvg != null ? `学业诊断 · 学能 ${status.e3.aptitudeAvg}/5` : "学业诊断 · 未测"}
                    onClick={onOpen ? () => open(e3Link()) : undefined}
                  />
                )}
                {status?.multi5 && (
                  <LinkChip
                    done={status.multi5.done}
                    label={status.multi5.done ? `多元五项 · ${status.multi5.note ?? "已测"}` : "多元智能五项 · 未测"}
                    onClick={
                      onOpen
                        ? () => open(status.multi5!.done ? { kind: "tab", tab: "multi5" } : { kind: "assess", start: "multi5" })
                        : undefined
                    }
                  />
                )}
                {status?.multi && (
                  <LinkChip done={status.multi.done} label={status.multi.done ? `多元八维 · ${status.multi.note ?? "已测"}` : "多元智能八维 · 未测"} />
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
                      <LinkChip done={!!st?.done} label={st?.done ? (st.note ?? "已测") : "未测"} />
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
                const cls = "rounded-lg border border-[#a8b08c]/50 bg-white/70 px-2 py-1.5 text-center";
                if (!onOpen) return <div key={d.key} className={cls}>{box}</div>;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => open(st?.done ? { kind: "tab", tab: d.tab } : { kind: "assess", start: d.key })}
                    className={`${cls} cursor-pointer transition hover:border-lime hover:bg-lime-pale/40`}
                    title={st?.done ? "点击查看图形与图表" : "点击直达测评"}
                  >
                    {box}
                  </button>
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
          点击任意徽章：已测评的直达对应模块看图形与图表，未测评的直接开始测评；红 &lt;3.0 卡点 · 黄 3.0-3.7 待提升 · 绿 ≥3.8 正常。
        </p>
      )}
    </div>
  );
}
