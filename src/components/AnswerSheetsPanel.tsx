/**
 * V62：伴学/管理端「答题卷 · 得分表」面板——学员全部测评的逐题作答 + E3 三阶九能得分表。
 * 逐题按分数段着色（红 <3.0 卡点 · 黄 3.0-3.7 待提升 · 绿 ≥3.8 正常）；
 * 每套卷可单独打印，也可一键全部打印（独立打印窗口，可另存 PDF）。
 */
import { useMemo } from "react";
import { Printer, ClipboardList } from "lucide-react";
import { buildAnswerBlocks, type RawAnswer } from "@/components/reports/answerBlocks";
import { isE3V37Result } from "@contracts/e3v37";
import AbilityScoreTable from "@/components/reports/AbilityScoreTable";
import { answerSheetsPrintHtml, downloadReport } from "@/lib/reportDownload";

/** 分数段文字色（与 e3v37Theme 一致）。 */
const BAND_CLASS = { bad: "text-[#8f1313]", mid: "text-[#8a6d1a]", ok: "text-[#5a9326]" } as const;

const printBtn =
  "inline-flex shrink-0 items-center gap-1 rounded-lg border border-lime/60 bg-lime-pale px-2 py-0.5 text-[11px] font-semibold text-olive hover:bg-lime/20";

export default function AnswerSheetsPanel({
  raw,
  e3,
  studentName,
}: {
  raw: RawAnswer[];
  e3?: unknown;
  studentName?: string;
}) {
  const blocks = useMemo(() => buildAnswerBlocks(raw), [raw]);
  const e3v37 = e3 && isE3V37Result(e3) ? e3 : null;
  /* 最新一次 e3 作答的 70 题原始评分（得分表逐题行用） */
  const ratings = useMemo(() => {
    const last = [...raw].reverse().find((r) => r.kind === "e3");
    const rs = (last?.answers as { ratings?: number[] } | undefined)?.ratings;
    return Array.isArray(rs) ? rs : null;
  }, [raw]);

  if (blocks.length === 0 && !e3v37) return null;

  return (
    <div className="paper-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="mono text-[10px] tracking-wider text-olive-mute">答题卷 · 得分表</div>
        <button
          onClick={() => downloadReport("答题卷 · 得分表", answerSheetsPrintHtml(blocks, e3v37), studentName)}
          className={printBtn}
        >
          <Printer size={13} /> 全部打印
        </button>
      </div>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-olive-mute">
        每套测评的逐题作答都在这里，按换算得分着色：红 &lt;3.0 卡点 · 黄 3.0-3.7 待提升 · 绿 ≥3.8 正常；点开单卷可单独打印。
      </p>

      {/* E3 三阶九能观察点得分表（含逐题作答/得分/判定） */}
      {e3v37 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-olive">三阶九能得分表</span>
            <button
              onClick={() => downloadReport("三阶九能得分表", answerSheetsPrintHtml([], e3v37), studentName)}
              className={printBtn}
            >
              <Printer size={12} /> 打印得分表
            </button>
          </div>
          <AbilityScoreTable e3={e3v37} ratings={ratings} />
        </div>
      )}

      {/* 各套测评答题卷（逐题作答） */}
      <div className="mt-3 space-y-2">
        {blocks.map((b) => (
          <details key={b.key} id={`sheet-${b.key}`} className="rounded-xl border border-border bg-cream/60 px-4 py-2.5">
            <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-olive">
              <ClipboardList size={14} className="shrink-0 text-olive-mute" />
              <span className="flex-1">{b.title}</span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  downloadReport(`答题卷 · ${b.title}`, answerSheetsPrintHtml([b], null), studentName);
                }}
                className={printBtn}
              >
                <Printer size={12} /> 打印
              </button>
            </summary>
            {b.note && <p className="mt-1.5 text-[11.5px] text-olive-mute">{b.note}</p>}
            <ol className="mt-2 space-y-1.5">
              {b.rows.map((row, ri) => (
                <li key={`${row.no}-${ri}`} className="flex gap-2 text-[12.5px] leading-relaxed text-olive-soft">
                  <span className="mono shrink-0 text-olive-mute">{row.no}.</span>
                  <span className="flex-1">{row.text}</span>
                  <span
                    className={`shrink-0 font-semibold ${
                      row.band ? BAND_CLASS[row.band] : row.bad ? "text-terra" : "text-olive"
                    }`}
                  >
                    {row.ans}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </div>
  );
}
