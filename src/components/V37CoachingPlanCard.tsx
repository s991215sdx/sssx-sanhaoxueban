import { useMemo, useState } from "react";
import type { E3V37Result } from "@contracts/e3v37";
import type { AcademicsData } from "@contracts/academics";
import { E3V37_ABILITY_TRAINING } from "@/data/training/e3v37Training";
import { METHOD_BY_ID, BOARD_LABEL, type TrainingMethod } from "@/data/training/methods";
import { E3V37_LEVEL_CLASS } from "@/components/reports/e3v37Theme";
import { combinedPrintHtml, downloadReport } from "@/lib/reportDownload";
import type { CombinedReport, CombinedSection } from "@/data/reports";
import { RichText } from "@/components/RichText";
import { ChevronDown, ChevronUp, ClipboardList, Download } from "lucide-react";

/** 训练项（一项 = 一个 level ≠ 正常的能力/条件格/学能项）。 */
type PlanItem = {
  key: string;
  /** 卡片标题，如「条件·资源 2.7/5 · 卡点」。 */
  title: string;
  level: "正常" | "待提升" | "卡点";
  rationale?: string;
  methods: TrainingMethod[];
  note?: string;
};

/** 方法块标题行（与 coachingPlan.ts methodBlock 首行同格式）。 */
function methodHeading(m: TrainingMethod): string {
  return `**${m.name}**（${BOARD_LABEL[m.board]} · ${m.sub}）`;
}

/** 方法块正文（与 coachingPlan.ts methodBlock 同格式：目的/怎么做/频率/工具）。 */
function methodBody(m: TrainingMethod): string {
  const steps = m.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return (
    (m.purpose ? `目的：${m.purpose}\n` : "") +
    (steps ? `怎么做：\n${steps}\n` : "") +
    (m.schedule ? `频率：${m.schedule}` : "") +
    (m.tool && m.tool !== "无" ? `\n工具：${m.tool}` : "")
  );
}

/** 按「条件 → 乐学 → 会学 → 善学 → 学能」顺序收集所有 level ≠ 正常 的项。 */
function buildPlanItems(e3: E3V37Result): PlanItem[] {
  const items: PlanItem[] = [];
  const push = (key: string, prefix: string, label: string, score: number, level: PlanItem["level"]) => {
    if (level === "正常") return;
    const rx = E3V37_ABILITY_TRAINING[label];
    items.push({
      key,
      title: `${prefix}·${label} ${score}/5 · ${level}`,
      level,
      rationale: rx?.rationale,
      methods: (rx?.methodIds ?? [])
        .map((id) => METHOD_BY_ID.get(id))
        .filter((m): m is TrainingMethod => m != null),
      note: rx?.note,
    });
  };
  // 条件三格（优先级链最前）
  for (const c of e3.systems.condition.cells) push(`cond-${c.key}`, "条件", c.label, c.score, c.level);
  // 九能（abilities 本身即 乐学→会学→善学 顺序）
  for (const a of e3.abilities) push(`ability-${a.key}`, a.system, a.label, a.score, a.level);
  // 学能三项
  for (const a of e3.aptitude) push(`apt-${a.key}`, "学能", a.label, a.score, a.level);
  return items;
}

/** 学习力陪跑训练方案卡（三阶九能 V3.7）：伴学工作台 / 管理后台学员详情用。 */
export default function V37CoachingPlanCard({
  name,
  grade,
  e3,
  academics,
}: {
  name: string;
  grade: string | null;
  e3: E3V37Result;
  academics?: AcademicsData | null;
}) {
  const [open, setOpen] = useState(false);
  const items = useMemo(() => buildPlanItems(e3), [e3]);

  const report = useMemo<CombinedReport>(() => {
    const sections: CombinedSection[] = items.map((it, i) => ({
      title: `${i + 1}、${it.title}`,
      paragraphs: [it.rationale ?? "", ...(it.note ? [`**补充约定**：${it.note}`] : [])].filter(Boolean),
      items: it.methods.map((m) => ({
        heading: methodHeading(m),
        text: methodBody(m),
        level: it.level,
      })),
    }));
    if (sections.length === 0) {
      sections.push({
        title: "总览",
        paragraphs: ["九能全部在正常线以上，保持节奏：每周回顾一次学习数据，按需从储备方法库拓展拔高。"],
      });
    }
    return {
      title: `${name} · 学习力陪跑训练方案（三阶九能 V3.7）`,
      subtitle: `依据 V3.7 三阶九能学业诊断编制 · ${new Date().toLocaleDateString("zh-CN")}`,
      overviewCards: [
        { label: "学员", value: name, note: grade ?? "年级未填" },
        {
          label: "主卡点",
          value: e3.mainBlock?.label ?? "无",
          note: e3.mainBlock ? `${e3.mainBlock.score}/5 · 优先干预` : "全部正常",
        },
        { label: "待训项", value: `${items.length} 项`, note: "判定 ≠ 正常（红/黄）" },
      ],
      sections,
    };
  }, [items, name, grade, e3]);

  return (
    <div className="paper-card accent-l border-lime p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-olive" />
          <span className="text-[14px] font-bold text-olive">学习力陪跑训练方案（三阶九能 V3.7）</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => downloadReport(report.title, combinedPrintHtml(report, { e3, academics: academics ?? undefined }), name)}
            className="flex items-center gap-1 rounded-lg border border-lime/60 bg-lime-pale px-2.5 py-1 text-[11.5px] font-semibold text-olive hover:bg-lime/20"
          >
            <Download size={12} /> 下载
          </button>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-[11.5px] text-olive-mute hover:bg-lime-pale hover:text-olive"
          >
            {open ? (
              <>
                收起 <ChevronUp size={13} />
              </>
            ) : (
              <>
                展开 <ChevronDown size={13} />
              </>
            )}
          </button>
        </div>
      </div>
      <p className="mt-1 text-[11.5px] text-olive-mute">
        {e3.mainBlock
          ? `主卡点：${e3.mainBlock.label} ${e3.mainBlock.score}/5（优先干预）；优先级链 条件 → 乐学 → 会学 → 善学 → 学能，前三优先：${e3.priorities
              .map((p) => `${p.label} ${p.score}`)
              .join("、")}`
          : "九能全部在正常线以上，保持节奏。"}
      </p>

      {open && (
        <div className="mt-3 space-y-3 border-t border-cream-deep pt-3">
          {items.length === 0 ? (
            <div className="rounded-xl border border-lime/50 bg-lime-pale px-3.5 py-3 text-[13px] font-semibold text-[#5a9326]">
              九能全部在正常线以上，保持节奏。
            </div>
          ) : (
            items.map((it) => (
              <div key={it.key} className={`rounded-xl border px-3.5 py-3 ${E3V37_LEVEL_CLASS[it.level]}`}>
                <div className="text-[13.5px] font-bold">{it.title}</div>
                {it.rationale && (
                  <p className="mt-1 text-[12.5px] leading-relaxed opacity-90">
                    <RichText text={it.rationale} />
                  </p>
                )}
                <div className="mt-2 space-y-2">
                  {it.methods.map((m) => (
                    <div key={m.id} className="rounded-lg border border-cream-deep bg-cream/70 px-3 py-2">
                      <div className="text-[12.5px] font-semibold text-olive">
                        <RichText text={methodHeading(m)} />
                      </div>
                      <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-olive-soft">
                        <RichText text={methodBody(m)} />
                      </p>
                    </div>
                  ))}
                </div>
                {it.note && (
                  <p className="mt-2 text-[12.5px] leading-relaxed opacity-90">
                    <RichText text={`**补充约定**：${it.note}`} />
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
