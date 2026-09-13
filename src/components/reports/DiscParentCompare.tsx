/**
 * 学生 × 家长 DISC 四因子对照条（「条件模块 · 支持系统」章节图表折叠用）。
 * 学生 DISC 四因子条 + 每位家长 DISC 四因子条（标签区分）。
 * V33.2：逐维度 |学生-家长| 差值标注——|Δ|≥3 标「⚠ 强烈冲突」红色 badge 并排在最前，
 * Δ=2 标「需留意」琥珀色；冲突点与管教风格改进建议文字由内容组写在章节 items 里，这里只出图与差值标注。
 */
import { DISC_THEORY, getDiscCombo } from "@/data/reports";
import type { DiscResult, DiscType } from "@contracts/assessments";

const DISC_COLOR: Record<"D" | "I" | "S" | "C", string> = {
  D: "#d44f3a",
  I: "#e8a33d",
  S: "#4e9e5f",
  C: "#3d8ec4",
};
const MAX = 24; // 统一量尺 0–24（V2 新版原生 0–24；V1 旧版 0–12 ×2 换算）

/** 四维度白话注释（家长能秒懂）。 */
export const DISC_DIM_PLAIN: Record<DiscType, string> = {
  D: "谁说了算、听谁的",
  I: "爱热闹、爱表达",
  S: "求稳、怕变化",
  C: "重细节、讲规矩",
};

/** 统一到 0–24 量尺：新版（version=2）原值；旧版二选一结果 ×2。 */
function nv(result: DiscResult, k: DiscType): number {
  return (result.dims[k] ?? 0) * (result.version === 2 ? 1 : 2);
}

function FactorBars({ label, tag, result, hot = [] }: { label: string; tag?: string; result: DiscResult; hot?: DiscType[] }) {
  const combo = getDiscCombo(result.dims);
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] font-bold text-olive">{label}</span>
        <span className="text-[11.5px] text-olive-mute">
          {combo.join("")} 型{tag ? ` · ${tag}` : ""}
        </span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {(["D", "I", "S", "C"] as const).map((k) => {
          const v = nv(result, k);
          const inCombo = combo.includes(k);
          const isHot = hot.includes(k);
          return (
            <div
              key={k}
              className={`flex items-center gap-2 rounded-lg px-1.5 py-0.5 -mx-1.5 ${isHot ? "bg-[#fbe3df] ring-1 ring-[#b91c1c]/50" : ""}`}
            >
              <span className={`w-16 shrink-0 text-[11.5px] ${isHot ? "font-bold text-[#8f1313]" : inCombo ? "font-bold text-olive" : "text-olive-mute"}`}>
                {k} · {DISC_THEORY.find((t) => t.type === k)?.name}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, (v / MAX) * 100)}%`, background: DISC_COLOR[k], opacity: inCombo || isHot ? 1 : 0.45 }}
                />
              </div>
              <span className={`mono w-5 shrink-0 text-right text-[11.5px] ${isHot ? "font-bold text-[#8f1313]" : "text-olive-soft"}`}>{v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 家长 × 学生逐维度差值标注（0–24 统一量尺）：|Δ|≥6 强烈冲突（红，排最前）；4–5 需留意（琥珀）。 */
function DimDeltaBadges({ label, parent, student }: { label: string; parent: DiscResult; student: DiscResult }) {
  const deltas = (["D", "I", "S", "C"] as DiscType[]).map((k) => ({
    k,
    student: nv(student, k),
    parent: nv(parent, k),
    abs: Math.abs(nv(student, k) - nv(parent, k)),
  }));
  const strong = deltas.filter((d) => d.abs >= 6).sort((a, b) => b.abs - a.abs);
  const watch = deltas.filter((d) => d.abs >= 4 && d.abs < 6);
  if (strong.length === 0 && watch.length === 0) {
    return (
      <p className="mt-1.5 text-[11.5px] text-olive-mute">
        与{label}四个维度差值都很小，行为频道总体接近。
      </p>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {strong.map((d) => (
        <span
          key={d.k}
          className="rounded-md border border-[#b91c1c]/50 bg-[#fbe3df] px-2 py-0.5 text-[11px] font-bold text-[#8f1313]"
        >
          ⚠ {d.k}（{DISC_DIM_PLAIN[d.k]}）明显顶牛：你 {d.student} 分 / {label} {d.parent} 分，差 {d.abs} 分
        </span>
      ))}
      {watch.map((d) => (
        <span
          key={d.k}
          className="rounded-md border border-[#c7a23a]/70 bg-[#f5e7c1] px-2 py-0.5 text-[11px] font-bold text-[#8a6d1a]"
        >
          {d.k}（{DISC_DIM_PLAIN[d.k]}）略有差异：你 {d.student} 分 / {label} {d.parent} 分，差 {d.abs} 分
        </span>
      ))}
    </div>
  );
}

export default function DiscParentCompare({
  student,
  parents,
}: {
  student: DiscResult;
  parents: { label: string; result: DiscResult }[];
}) {
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">亲子 DISC 行为风格对照</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">
        看看孩子和家长各自最自然的行为模式差在哪里（类型没有好坏，只有不同）。分数已统一换算到 0–24
        量尺对照（旧版二选一结果 ×2）；同一维度两边差 6 分以上算「明显顶牛」（日常相处最容易频道对不上，红色标出），差 4–5 分「略有差异」。
      </p>
      <div className="mt-3 space-y-4">
        {(() => {
          const dims = ["D", "I", "S", "C"] as DiscType[];
          // 每位家长与学生的强烈冲突维度（|Δ|≥6），红色高亮；学生条上标出所有家长冲突维度的并集。
          const perParent = parents.map((p) => dims.filter((k) => Math.abs(nv(p.result, k) - nv(student, k)) >= 6));
          const unionHot = [...new Set(perParent.flat())];
          return (
            <>
              <FactorBars
                label="学生（你）"
                tag={DISC_THEORY.find((t) => t.type === student.primary)?.name}
                result={student}
                hot={unionHot}
              />
              {parents.map((p, i) => (
                <div key={`${p.label}-${i}`}>
                  <FactorBars
                    label={`家长 · ${p.label}`}
                    tag={DISC_THEORY.find((t) => t.type === p.result.primary)?.name}
                    result={p.result}
                    hot={perParent[i]}
                  />
                  <DimDeltaBadges label={p.label} parent={p.result} student={student} />
                </div>
              ))}
            </>
          );
        })()}
      </div>
    </div>
  );
}
