/**
 * 附录 · 三阶九能观察点得分表（替代 V2.7 的 SubscaleScoreTable）。
 * 大类 rowSpan：乐学/会学/善学三阶 + 条件三格 + 学能；每能一行小计（分数+判定），
 * 下挂逐题行（题号 + kp + 题干小字 + 得分 + 判定）。学能 3 题注明「单独报告不进总分」。
 * 逐题数据来自 scoreE3V37Items(stage, ratings)；ratings 长度不足 70 时只渲染小计行。
 */
import { scoreE3V37Items, E3V37_RATING_COUNT } from "@contracts/e3v37";
import type { E3V37Result, E3V37Level, E3V37ItemScore, E3V37System } from "@contracts/e3v37";
import { e3v37LevelTextClass, E3V37_LEVEL_CAPTION } from "./e3v37Theme";

/** 1-5 分选项文案（与作答端一致）：显示原答案，得分列显示换算后的有效分。 */
const FREQ5 = ["从不", "很少", "有时", "经常", "总是"] as const;

type SubRow = { key: string; label: string; score: number | null; level: E3V37Level | null; note?: string };

function GroupRows({
  subs,
  items,
  groupLabel,
  groupScore,
  groupNote,
  firstGroupCell,
}: {
  subs: SubRow[];
  items: E3V37ItemScore[];
  groupLabel: string;
  groupScore?: string;
  groupNote?: string;
  /** 是否在该组首行渲染大类单元格（rowSpan）。 */
  firstGroupCell: boolean;
}) {
  const systemOf = (): E3V37System =>
    groupLabel === "条件" ? "条件" : groupLabel === "学能" ? "学能" : (groupLabel as E3V37System);
  const itemsOf = (label: string) =>
    items
      .filter((it) => it.ability === label && it.system === systemOf())
      .sort((a, b) => a.no - b.no);
  const rowCount = subs.reduce((n, s) => n + 1 + itemsOf(s.label).length, 0);
  let groupCellDone = false;
  return (
    <>
      {subs.flatMap((s) => {
        const qItems = itemsOf(s.label);
        const headRow = (
          <tr key={s.key} className={`bg-cream/70 ${s.level && s.level !== "正常" ? "bg-[#fbe3df]/50" : ""}`}>
            {firstGroupCell && !groupCellDone && (() => { groupCellDone = true; return (
              <td rowSpan={rowCount} className="w-16 border border-border px-2 py-1.5 align-top font-bold text-olive">
                {groupLabel}
                {groupScore ? <span className="mono ml-1 font-semibold">{groupScore}</span> : null}
                {groupNote ? <span className="mt-0.5 block text-[10.5px] font-normal leading-snug text-olive-mute">{groupNote}</span> : null}
              </td>
            ); })()}
            <td className="border border-border px-2 py-1.5 font-semibold text-olive">
              {s.label}
              {s.note ? <span className="ml-1 text-[10.5px] font-normal text-olive-mute">（{s.note}）</span> : null}
            </td>
            <td className="border border-border px-2 py-1.5 text-center text-[11.5px] text-olive-mute">
              {items.length > 0 ? "—" : ""}
            </td>
            <td className={`border border-border px-2 py-1.5 text-center mono font-bold ${s.level ? e3v37LevelTextClass(s.level) : "text-olive"}`}>
              {s.score ?? "-"}
            </td>
            <td className={`border border-border px-2 py-1.5 text-center text-[11.5px] font-semibold ${s.level ? e3v37LevelTextClass(s.level) : ""}`}>
              {s.level ?? "-"}
            </td>
          </tr>
        );
        const qRows = qItems.map((it) => (
          <tr key={`q${it.no}`} className={it.level !== "正常" ? "bg-[#fbe3df]/40" : ""}>
            <td className="border border-border px-2 py-1 text-olive-soft">
              <span className="mono text-[11px] text-olive-mute">{it.no}.</span>{" "}
              <span className="font-medium">{it.kp}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-olive-mute">{it.text}</span>
            </td>
            <td className="border border-border px-2 py-1 text-center text-[12px] text-olive-soft">
              {it.raw >= 1 && it.raw <= 5 ? (
                <>
                  <span className="mono">{it.raw}</span> · {FREQ5[it.raw - 1]}
                  {it.raw !== it.score && (
                    <span className="ml-1 rounded bg-butter/60 px-1 py-0.5 text-[10px] text-olive-mute">反向计分</span>
                  )}
                </>
              ) : (
                <span className="text-olive-mute">未答</span>
              )}
            </td>
            <td className={`border border-border px-2 py-1 text-center mono text-[12px] font-semibold ${e3v37LevelTextClass(it.level)}`}>
              {it.score}
            </td>
            <td className={`border border-border px-2 py-1 text-center text-[11px] font-semibold ${e3v37LevelTextClass(it.level)}`}>
              {it.level}
            </td>
          </tr>
        ));
        return [headRow, ...qRows];
      })}
    </>
  );
}

export default function AbilityScoreTable({
  e3,
  ratings,
}: {
  e3: E3V37Result;
  /** 最新一次 e3 作答的 70 题原始评分；长度 70 才渲染逐题行。 */
  ratings?: number[] | null;
}) {
  const items = ratings && ratings.length === E3V37_RATING_COUNT ? scoreE3V37Items(e3.stage, ratings) : [];
  const coreScore = (sys: string) => e3.systems.core.find((c) => c.key === sys)?.score;
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">附录 · 三阶九能观察点得分表</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">
        每能一行小计，下挂该能每道题的作答与得分：作答是你选的原答案（1=从不 / 2=很少 / 3=有时 / 4=经常 / 5=总是），得分按 5 分制换算（反向题已换算，越低越需关注）：{E3V37_LEVEL_CAPTION}。
        {items.length === 0 && "（本次记录未保存逐题作答，仅显示能级小计；重新完成一次诊断即可看到逐题明细。）"}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-cream-deep/60 text-olive">
              <th className="border border-border px-2 py-1.5 text-left">大类</th>
              <th className="border border-border px-2 py-1.5 text-left">能力 / 题目</th>
              <th className="border border-border px-2 py-1.5 text-center">作答（原答案）</th>
              <th className="border border-border px-2 py-1.5 text-center">得分（换算）</th>
              <th className="border border-border px-2 py-1.5 text-center">判定</th>
            </tr>
          </thead>
          <tbody>
            {(["乐学", "会学", "善学"] as const).map((sys) => (
              <GroupRows
                key={sys}
                groupLabel={sys}
                groupScore={coreScore(sys) != null ? `${coreScore(sys)}/5` : undefined}
                firstGroupCell
                items={items}
                subs={e3.abilities
                  .filter((a) => a.system === sys)
                  .map((a) => ({ key: a.key, label: a.label, score: a.score, level: a.level }))}
              />
            ))}
            <GroupRows
              groupLabel="条件"
              groupNote="支持系统，不进总分"
              firstGroupCell
              items={items}
              subs={e3.systems.condition.cells.map((c) => ({ key: c.key, label: c.label, score: c.score, level: c.level }))}
            />
            <GroupRows
              groupLabel="学能"
              groupNote="单独报告不进总分"
              firstGroupCell
              items={items}
              subs={e3.aptitude.map((a) => ({
                key: a.key,
                label: a.label,
                score: a.score,
                level: a.level,
                note: "单独报告不进总分",
              }))}
            />
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-olive-mute">
        学能三项（注意力/工作记忆/加工速度）反映当前加工效率，单独报告不进总分，不是智力、也不代表潜力上限；条件系统（状态/关系/资源）同样单独报告。
      </p>
    </div>
  );
}
