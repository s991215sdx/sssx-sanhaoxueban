import { useState } from "react";
import type { MbtiResult, DiscResult } from "@contracts/assessments";
import { isE3V37Result } from "@contracts/e3v37";
import type { E3V37Result } from "@contracts/e3v37";
import { isE3V37ParentResult } from "@contracts/e3v37Parent";
import type { MultiResult } from "@contracts/multi";
import { MULTI_DIM_ORDER, MULTI_DIM_LABEL } from "@contracts/multi";
import type { AnchorResult } from "@contracts/careerAnchor";
import type { HollandResult } from "@contracts/holland";
import type { MentalResult } from "@contracts/mentalHealth";
import type { Multi5Result } from "@contracts/multi5";
import type { AcademicsData } from "@contracts/academics";
import { MBTI_REPORTS, DISC_REPORTS, buildCombinedReport } from "@/data/reports";
import { buildE3Report } from "@/data/reports/combined";
import type { CombinedSection } from "@/data/reports";
import {
  downloadReport,
  mbtiPrintHtml,
  discPrintHtml,
  multiPrintHtml,
  combinedPrintHtml,
} from "@/lib/reportDownload";
import { RichText } from "@/components/RichText";
import { ChevronDown, ChevronUp, Download } from "lucide-react";

/**
 * 学员测评「完整报告」卡片组：伴学师/管理员共用的学员详情抽屉使用。
 * 每张卡：类型名 + 核心结果 + 「查看完整报告」（展开/收起）+「下载报告」。
 */

/* ---------------- 通用章节渲染（buildE3Report / buildCombinedReport 的 sections） ---------------- */

function SectionsView({ sections }: { sections: CombinedSection[] }) {
  return (
    <div className="space-y-3">
      {sections.map((s, i) => (
        <div key={i} className="rounded-xl border border-cream-deep bg-cream/50 px-3.5 py-3">
          <div className="text-[13px] font-bold text-olive">
            {i + 1}. {s.title}
          </div>
          {s.paragraphs?.map((p, j) => (
            <RichText key={j} text={p} className="mt-1.5 block text-[12.5px] leading-relaxed text-olive-soft" />
          ))}
          {s.bullets && (
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-olive-soft">
              {s.bullets.map((b, j) => (
                <li key={j}>
                  <RichText text={b} />
                </li>
              ))}
            </ul>
          )}
          {s.items?.map((it, j) => (
            <div
              key={j}
              className={`mt-2 rounded-lg border-l-4 bg-cream px-3 py-2 ${
                it.level === "卡点"
                  ? "border-terra"
                  : it.level === "待提升"
                    ? "border-butter"
                    : "border-lime"
              }`}
            >
              <RichText text={it.heading} className="block text-[12.5px] font-semibold text-olive" />
              <RichText text={it.text} className="mt-1 block text-[12px] leading-relaxed text-olive-soft" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------------- 卡片骨架 ---------------- */

function ReportCard({
  title,
  core,
  expanded,
  onToggle,
  onDownload,
  children,
}: {
  title: string;
  core: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  onDownload: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-cream-deep bg-cream/60 px-3.5 py-3">
      <div className="text-[13px] font-semibold text-olive">
        {title}：{core}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={onToggle}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-cream-deep bg-cream py-1.5 text-[12px] font-medium text-olive transition-colors hover:bg-lime-pale"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? "收起报告" : "查看完整报告"}
        </button>
        <button
          onClick={onDownload}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-lime/60 bg-lime-pale py-1.5 text-[12px] font-medium text-olive transition-colors hover:bg-lime/20"
        >
          <Download size={13} />
          下载报告
        </button>
      </div>
      {expanded && <div className="mt-3">{children}</div>}
    </div>
  );
}

/* ---------------- MBTI ---------------- */

export function MbtiReportCard({ mbti, studentName }: { mbti: MbtiResult; studentName?: string }) {
  const [open, setOpen] = useState(false);
  const report = MBTI_REPORTS[mbti.type];
  if (!report) {
    return (
      <div className="rounded-xl border border-cream-deep bg-cream/60 px-3.5 py-3">
        <div className="text-[13px] font-semibold text-olive">MBTI 性格测评：{mbti.type}</div>
        <p className="mt-1 text-[12px] text-olive-mute">暂无该类型的详细报告文案。</p>
      </div>
    );
  }
  return (
    <ReportCard
      title="MBTI 性格测评"
      core={
        <>
          {mbti.type} · {report.name}
        </>
      }
      expanded={open}
      onToggle={() => setOpen((v) => !v)}
      onDownload={() => downloadReport("MBTI 性格详版报告", mbtiPrintHtml(mbti), studentName)}
    >
      <div className="space-y-3 text-[12.5px] leading-relaxed text-olive-soft">
        <RichText text={report.headline} className="block text-[13px] font-semibold text-olive" />
        <div className="flex flex-wrap gap-1.5">
          {report.tags.map((t) => (
            <span key={t} className="rounded-full bg-lime-pale px-2 py-0.5 text-[11px] text-olive">
              {t}
            </span>
          ))}
        </div>
        <div className="rounded-lg bg-cream px-3 py-2">
          <span className="font-semibold text-olive">
            {report.figure.name}（{report.figure.title}）
          </span>
          ：{report.figure.quote}
        </div>
        {(
          [
            ["性格特征", report.traits],
            ["性格优势", report.strengths],
            ["潜在弱点", report.weaknesses],
            ["学习中的优势", report.studyStrengths],
            ["学习中的盲点", report.studyBlindspots],
            ["发展建议", report.suggestions],
          ] as const
        ).map(([label, list]) => (
          <div key={label}>
            <div className="font-semibold text-olive">{label}</div>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {list.map((t, i) => (
                <li key={i}>
                  <RichText text={t} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <div className="font-semibold text-olive">校园五幕</div>
          <div className="mt-1 space-y-1.5">
            {report.scenes.map((sc) => (
              <div key={sc.scene} className="rounded-lg bg-cream px-3 py-2">
                <span className="font-semibold text-olive">{sc.scene}：</span>
                <RichText text={sc.text} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </ReportCard>
  );
}

/* ---------------- DISC ---------------- */

export function DiscReportCard({ disc, studentName }: { disc: DiscResult; studentName?: string }) {
  const [open, setOpen] = useState(false);
  const report = DISC_REPORTS[disc.primary];
  return (
    <ReportCard
      title="DISC 行为风格"
      core={
        <>
          {disc.primary} 型{report ? ` · ${report.name}` : ""}
          <span className="mono ml-2 text-[11.5px] font-normal text-olive-soft">
            D {disc.dims.D} · I {disc.dims.I} · S {disc.dims.S} · C {disc.dims.C}
          </span>
        </>
      }
      expanded={open}
      onToggle={() => setOpen((v) => !v)}
      onDownload={() => downloadReport("DISC 行为详版报告", discPrintHtml(disc), studentName)}
    >
      {report ? (
        <div className="space-y-3 text-[12.5px] leading-relaxed text-olive-soft">
          <RichText text={report.headline} className="block text-[13px] font-semibold text-olive" />
          <div className="flex flex-wrap gap-1.5">
            {report.keywords.map((k) => (
              <span key={k} className="rounded-full bg-lime-pale px-2 py-0.5 text-[11px] text-olive">
                {k}
              </span>
            ))}
          </div>
          <RichText text={report.overview} className="block" />
          <div>
            <div className="font-semibold text-olive">校园五幕</div>
            <div className="mt-1 space-y-1.5">
              {report.scenes.map((sc) => (
                <div key={sc.scene} className="rounded-lg bg-cream px-3 py-2">
                  <span className="font-semibold text-olive">{sc.scene}：</span>
                  <RichText text={sc.text} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-cream px-3 py-2">
            <span className="font-semibold text-olive">压力下的你：</span>
            <RichText text={report.underPressure} />
          </div>
          <div className="rounded-lg bg-cream px-3 py-2">
            <span className="font-semibold text-olive">最喜欢的老师风格：</span>
            <RichText text={report.teacherFit} />
          </div>
          {(
            [
              ["可能阻碍发展的行为", report.obstacles],
              ["你需要的支持", report.supports],
              ["这样与你相处最有效", report.communicationTips],
            ] as const
          ).map(([label, list]) => (
            <div key={label}>
              <div className="font-semibold text-olive">{label}</div>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {list.map((t, i) => (
                  <li key={i}>
                    <RichText text={t} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-olive-mute">暂无该类型的详细报告文案。</p>
      )}
    </ReportCard>
  );
}

/* ---------------- E3 学习力诊断 ---------------- */

/** V3.7 三阶九能概览（九能 chips + 主卡点 + 红线）；V2.7 老数据显示重测提示。 */
export function E3ReportCard({ e3, studentName }: { e3: E3V37Result | unknown; studentName?: string }) {
  const [open, setOpen] = useState(false);
  if (!isE3V37Result(e3)) {
    return (
      <div className="rounded-xl border border-[#c7a23a]/60 bg-[#f5e7c1] px-3.5 py-3 text-[13px] font-semibold text-[#8a6d1a]">
        学业诊断（E3）：旧版结果——学业诊断已升级为 V3.7 三阶九能版，学生需重测（约 16-18 分钟）。
      </div>
    );
  }
  return (
    <ReportCard
      title={`学业诊断（三阶九能 V3.7 · ${e3.stageLabel}）`}
      core={
        <>
          {e3.mainBlock ? `主卡点：${e3.mainBlock.label}` : "九能全部正常"}
          <span className="mono ml-2 text-[11.5px] font-normal text-olive-soft">
            {e3.systems.core.map((dd) => `${dd.key} ${dd.score}`).join(" · ")}
          </span>
          {e3.redFlags.length > 0 && (
            <span className="ml-1.5 text-[11.5px] font-normal text-terra">⚠ {e3.redFlags.join("；")}</span>
          )}
        </>
      }
      expanded={open}
      onToggle={() => setOpen((v) => !v)}
      onDownload={() => downloadReport(`学业诊断报告（三阶九能 V3.7）`, combinedPrintHtml(buildE3Report(e3), { e3 }), studentName)}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {e3.abilities.map((a) => (
            <span
              key={a.key}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                a.level === "卡点" ? "bg-[#fbe3df] text-[#8f1313]" : a.level === "待提升" ? "bg-[#f5e7c1] text-[#8a6d1a]" : "bg-lime-pale text-[#5a9326]"
              }`}
            >
              {a.system}·{a.label} {a.score}
            </span>
          ))}
        </div>
        <SectionsView sections={buildE3Report(e3).sections} />
      </div>
    </ReportCard>
  );
}

/* ---------------- 多元智能 ---------------- */

export function MultiReportCard({ multi, studentName }: { multi: MultiResult; studentName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <ReportCard
      title="多元智能"
      core={<>Top3：{multi.top3.map((k) => MULTI_DIM_LABEL[k]).join(" · ")}</>}
      expanded={open}
      onToggle={() => setOpen((v) => !v)}
      onDownload={() => downloadReport("多元智能详版报告", multiPrintHtml(multi), studentName)}
    >
      <div className="space-y-2.5 text-[12.5px] text-olive-soft">
        <RichText text={multi.summary} className="block leading-relaxed" />
        <div className="space-y-1.5">
          {MULTI_DIM_ORDER.map((k) => {
            const v = multi.dims[k];
            const top = multi.top3.includes(k);
            return (
              <div key={k} className="flex items-center gap-2">
                <span className={`w-20 shrink-0 text-[11.5px] ${top ? "font-semibold text-olive" : "text-olive-mute"}`}>
                  {MULTI_DIM_LABEL[k]}
                  {top && " ★"}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-deep">
                  <div
                    className={`h-full rounded-full ${top ? "bg-lime" : "bg-olive-mute/50"}`}
                    style={{ width: `${Math.max(0, Math.min(100, (v / 5) * 100))}%` }}
                  />
                </div>
                <span className="mono w-8 shrink-0 text-right text-[11px] text-olive-soft">{v.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </ReportCard>
  );
}

/* ---------------- 综合报告（mbti+disc+e3 齐全时出现） ---------------- */

export function CombinedReportCard({
  mbti,
  disc,
  e3,
  multi,
  academics,
  optional,
  studentName,
}: {
  mbti: MbtiResult;
  disc: DiscResult;
  e3: E3V37Result;
  multi?: MultiResult | null;
  academics?: AcademicsData | null;
  /** 选做测评结果（multi5/anchor/holland/mental/e3parent），用于综合分析章节。 */
  optional?: Record<string, unknown> | null;
  studentName?: string;
}) {
  const [open, setOpen] = useState(false);
  const mr = MBTI_REPORTS[mbti.type];
  const dr = DISC_REPORTS[disc.primary];
  if (!mr || !dr) return null;
  const e3parent = isE3V37ParentResult(optional?.e3parent) ? optional.e3parent : undefined;
  const report = buildCombinedReport(mbti, mr, disc, dr, e3, {
    academics: academics ?? undefined,
    multi5: optional?.multi5 as Multi5Result | undefined,
    anchor: optional?.anchor as AnchorResult | undefined,
    holland: optional?.holland as HollandResult | undefined,
    mental: optional?.mental as MentalResult | undefined,
    e3parent,
  });
  return (
    <ReportCard
      title={report.title}
      core={<span className="text-[11.5px] font-normal text-olive-soft">{report.subtitle}</span>}
      expanded={open}
      onToggle={() => setOpen((v) => !v)}
      onDownload={() =>
        downloadReport(
          "综合学习力报告",
          combinedPrintHtml(report, { e3, multi: multi ?? undefined, academics: academics ?? undefined }),
          studentName,
        )
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {report.overviewCards.map((c) => (
            <div key={c.label} className="rounded-lg border border-cream-deep bg-cream px-3 py-2">
              <div className="text-[10.5px] text-olive-mute">{c.label}</div>
              <div className="text-[13px] font-bold text-olive">{c.value}</div>
              <div className="text-[10.5px] leading-snug text-olive-soft">{c.note}</div>
            </div>
          ))}
        </div>
        <SectionsView sections={report.sections} />
      </div>
    </ReportCard>
  );
}
