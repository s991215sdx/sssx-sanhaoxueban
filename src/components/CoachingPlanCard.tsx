import { useMemo, useState } from "react";
import { buildCoachingPlan } from "@/data/reports/coachingPlan";
import { combinedPrintHtml, downloadReport } from "@/lib/reportDownload";
import { RichText } from "@/components/RichText";
import type { E3V27Result, MbtiResult, DiscResult } from "@contracts/assessments";
import type { AcademicsData } from "@contracts/academics";
import type { MultiResult } from "@contracts/multi";
import { ChevronDown, ChevronUp, ClipboardList, Download } from "lucide-react";

const LEVEL_CLASS: Record<string, string> = {
  正常: "border-lime/50 bg-lime-pale",
  警戒: "border-butter bg-butter/60",
  危险: "border-terra/40 bg-terra/10",
};

/** 学习力 1 对 1 陪跑训练方案卡：伴学工作台 / 管理后台学员详情用。 */
export default function CoachingPlanCard({
  name,
  grade,
  e3,
  mbti,
  disc,
  multi,
  academics,
}: {
  name: string;
  grade: string | null;
  e3: E3V27Result;
  mbti?: MbtiResult | null;
  disc?: DiscResult | null;
  multi?: MultiResult | null;
  academics?: AcademicsData | null;
}) {
  const [open, setOpen] = useState(false);
  const plan = useMemo(
    () => buildCoachingPlan({ name, grade, e3, mbti, disc, multi, academics }),
    [name, grade, e3, mbti, disc, multi, academics],
  );

  return (
    <div className="paper-card accent-l border-lime p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-olive" />
          <span className="text-[14px] font-bold text-olive">学习力 1 对 1 陪跑训练方案</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => downloadReport(plan.title, combinedPrintHtml(plan, { e3 }))}
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
        依据 {name} 的综合测评自动编制：画像诊断 · 陪跑框架 · 专题训练 · 每周检查表 · 协同分工 · 储备方法库
      </p>

      {open && (
        <div className="mt-3 space-y-3 border-t border-cream-deep pt-3">
          {plan.sections.map((s, i) => (
            <div key={i} className="rounded-xl border border-cream-deep bg-cream/50 px-3.5 py-3">
              <div className="text-[13.5px] font-bold text-olive">
                <RichText text={s.title} />
              </div>
              {s.paragraphs?.map((p, j) => (
                <p key={j} className="mt-1.5 text-[12.5px] leading-relaxed text-olive-soft">
                  <RichText text={p} />
                </p>
              ))}
              {s.items && (
                <div className="mt-2 space-y-2">
                  {s.items.map((it, j) => (
                    <div
                      key={j}
                      className={`rounded-lg border px-3 py-2 ${it.level ? LEVEL_CLASS[it.level] : "border-cream-deep bg-cream/70"}`}
                    >
                      <div className="text-[12.5px] font-semibold text-olive">
                        <RichText text={it.heading} />
                      </div>
                      <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-olive-soft">
                        <RichText text={it.text} />
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
