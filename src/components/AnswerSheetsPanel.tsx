/**
 * V62：伴学/管理端「答题卷 · 得分表」面板——学员全部测评的逐题作答 + E3 三阶九能得分表。
 * 逐题按分数段着色（红 <3.0 卡点 · 黄 3.0-3.7 待提升 · 绿 ≥3.8 正常）；
 * 每套卷可单独打印，也可一键全部打印（独立打印窗口，可另存 PDF）。
 */
import { useMemo } from "react";
import { Printer, ClipboardList, TreePine } from "lucide-react";
import { buildAnswerBlocks, type RawAnswer } from "@/components/reports/answerBlocks";
import { isE3V37Result } from "@contracts/e3v37";
import AbilityScoreTable from "@/components/reports/AbilityScoreTable";
import { answerSheetsPrintHtml, downloadReport } from "@/lib/reportDownload";

/** 分数段文字色（与 e3v37Theme 一致）。 */
const BAND_CLASS = { bad: "text-[#A82524]", mid: "text-[#8A6500]", ok: "text-[#2F7A41]" } as const;

const printBtn =
  "inline-flex shrink-0 items-center gap-1 rounded-lg border border-lime/60 bg-lime-pale px-2 py-0.5 text-[11px] font-semibold text-olive hover:bg-butter/25";

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
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-1 rounded-full bg-[#0C7064]" />
          <ClipboardList size={14} className="text-[#0C7064]" />
          <span className="text-[14px] font-bold text-[#1E3530]">答题卷 · 得分表</span>
        </div>
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
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#1E3530]">
              <TreePine size={14} />
              三阶九能得分表
            </span>
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

      {/* 各套测评答题卷（逐题作答）——v114：改信标 + 细线分隔的清爽列表样式 */}
      <div className="mt-3 divide-y divide-border/70">
        {blocks.map((b) => {
          /* 标题末尾的（日期）拆出来单独灰色显示；E3 系显示 E 信标，量表类显示 S */
          const m = b.title.match(/^(.*?)（(\d{4}\/\d{1,2}\/\d{1,2})）$/);
          const mainTitle = m ? m[1] : b.title;
          const dateStr = m ? m[2] : null;
          const letter = b.key.startsWith("e3") ? "E" : "S";
          return (
            <details key={b.key} id={`sheet-${b.key}`} className="group">
              <summary className="flex cursor-pointer items-center gap-3 py-3 transition-colors hover:bg-cream-deep/40">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF2EC] text-[12.5px] font-bold text-olive-soft">
                  {letter}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-olive">
                  {mainTitle}
                  {dateStr && <span className="ml-1.5 text-[12px] font-normal text-olive-mute">· {dateStr}</span>}
                </span>
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
              {b.note && <p className="mt-1 text-[11.5px] text-olive-mute pl-12">{b.note}</p>}
              <ol className="mt-2 space-y-1.5 pb-2 pl-12">
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
          );
        })}
      </div>
    </div>
  );
}
