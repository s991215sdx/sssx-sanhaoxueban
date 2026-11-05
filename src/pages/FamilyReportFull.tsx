/**
 * 家庭教育认知报告 · 完整版（v250）
 *
 * 这一页只做三件事：取数、注入版式、把 13 页摆出来。
 * 判定与文案全在 contracts/familyFullReport.ts 与 pages/famReportHtml.ts，
 * 这里不写任何一句报告里的话——改文案改那两个文件，别在这里打补丁。
 *
 * 打印：@page 必须覆盖全局的 12mm 边距，否则 210mm 的版面会被缩成 186mm，
 * 分页全乱。所以样式走 head 注入（在 index.css 之后），卸载时再摘掉。
 */
import { useEffect, useMemo } from "react";
import { Link } from "react-router";
import { Printer } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAssessmentPass } from "@/components/coach/passRequest";
import { FAM_REPORT_CSS, renderFamilyReportPages } from "./famReportHtml";

const STYLE_ID = "fam-report-full-style";

export default function FamilyReportFull({
  viewer = "student",
  studentId,
}: {
  viewer?: "student" | "tutor";
  /** 伴学师查看学员时传学员 userId。 */
  studentId?: number;
}) {
  const { data, isLoading } = trpc.assessment.familyFull.useQuery(
    studentId != null ? { userId: studentId } : undefined,
    { retry: false },
  );
  const openPass = useAssessmentPass();

  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    /* 放在 head 末尾：@page 的覆盖必须排在 index.css 之后才有用 */
    el.textContent = `${FAM_REPORT_CSS}\n@page{size:A4;margin:0}`;
    document.head.appendChild(el);
    return () => {
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);

  const html = useMemo(() => (data?.report ? renderFamilyReportPages(data.report) : ""), [data?.report]);

  if (isLoading) return <div className="paper-card h-40 animate-pulse bg-cream-deep/50" />;

  const has = data?.has;
  if (!has || (!has.student && !has.parent)) {
    return (
      <div className="paper-card p-8 text-center">
        <p className="text-[15px] font-semibold text-olive">还没有家庭测评的数据</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-olive-mute">
          这份完整版报告要四份作答：孩子关系卷 {data?.report.meta.counts.studentRel} 题 + 孩子 DISC{" "}
          {data?.report.meta.counts.discGroups} 组，家长卷 {data?.report.meta.counts.parentItems} 题 + 家长 DISC{" "}
          {data?.report.meta.counts.discGroups} 组（另有学习力诊断 70 题与心理量表 16 题做底）。
          两份都到齐，才能做「你以为的」和「他实际答的」的对照。
        </p>
        {viewer === "tutor" ? (
          <>
            <button
              onClick={() => openPass?.("familyparent")}
              className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-lime"
            >
              出家长卷的码
            </button>
            <p className="mt-2 text-[11.5px] leading-relaxed text-olive-mute">
              家长的码里含 {data?.report.meta.counts.parentItems} 道家长题 + {data?.report.meta.counts.discGroups} 组 DISC，
              扫一次就够；孩子那份从测评中心进。
            </p>
          </>
        ) : (
          <Link
            to="/assessments?start=familystudent"
            className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-cream no-underline hover:bg-lime"
          >
            去做家庭关系测评
          </Link>
        )}
      </div>
    );
  }

  const missing: string[] = [];
  if (!has.parent) missing.push("家长卷");
  if (!has.discParent) missing.push("家长 DISC");
  if (!has.disc) missing.push("孩子 DISC");
  if (!has.e3) missing.push("学习力诊断 70 题");
  if (!has.mental) missing.push("心理量表");

  return (
    <div className="famrpt">
      <div className="no-print mx-auto mb-3 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-cream px-4 py-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-olive">
            完整版 · 10 节 + 附录 · 共 13 页
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-olive-soft">
            {missing.length
              ? `这几份还没到，对应页先留白：${missing.join("、")}。补齐后重开这一页即可。`
              : "四份作答齐了，13 页全部可核对。"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {viewer === "tutor" && !has.parent && (
            <button
              onClick={() => openPass?.("familyparent")}
              className="rounded-xl border border-border bg-white px-3 py-2 text-[12.5px] font-semibold text-olive hover:border-lime"
            >
              出家长卷的码
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-cream hover:bg-lime"
          >
            <Printer size={14} /> 打印 / 另存 PDF
          </button>
        </div>
      </div>

      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
