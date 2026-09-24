/**
 * 附录 · 三阶九能观察点得分表（替代 V2.7 的 SubscaleScoreTable）。
 * 每能一行小计（分数+判定）默认展示，V63 起逐题明细行默认折叠、点能力行展开；
 * 点开可见该能每道题的作答与得分。学能 3 题注明「单独报告不进总分」。
 * 逐题数据来自 scoreE3V37Items(stage, ratings)；ratings 长度不足 70 时只有小计行（无明细可展开）。
 */
import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { scoreE3V37Items, E3V37_RATING_COUNT } from "@contracts/e3v37";
import type { E3V37Result, E3V37Level, E3V37ItemScore, E3V37System } from "@contracts/e3v37";
import { e3v37LevelTextClass, E3V37_LEVEL_CAPTION } from "./e3v37Theme";

/** 1-5 分选项文案（与作答端一致）：显示原答案，得分列显示换算后的有效分。 */
const FREQ5 = ["从不", "很少", "有时", "经常", "总是"] as const;

type SubRow = { key: string; label: string; score: number | null; level: E3V37Level | null; note?: string };

/** 单个能力组：小计行（点击展开/收起）+ 逐题明细表。 */
function AbilityGroup({
  sub,
  items,
  systemOf,
  expanded,
  onToggle,
}: {
  sub: SubRow;
  items: E3V37ItemScore[];
  systemOf: () => E3V37System;
  expanded: boolean;
  onToggle: () => void;
}) {
  const qItems = items
    .filter((it) => it.ability === sub.label && it.system === systemOf())
    .sort((a, b) => a.no - b.no);
  const hasItems = qItems.length > 0;
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* 小计行：默认状态，点击展开逐题明细 */}
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left transition ${
          sub.level && sub.level !== "正常" ? "bg-[#fbe3df]/40" : "bg-cream/70 hover:bg-cream"
        }`}
      >
        {hasItems ? (
          expanded ? (
            <ChevronDown size={14} className="shrink-0 text-olive-mute" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-olive-mute" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <span className="text-[13px] font-semibold text-olive">{sub.label}</span>
          {sub.note && <span className="ml-1 text-[10.5px] text-olive-mute">（{sub.note}）</span>}
          {hasItems && (
            <span className="ml-1.5 text-[10.5px] text-olive-mute">{expanded ? "收起明细" : `逐题明细 ${qItems.length} 题`}</span>
          )}
        </span>
        <span className={`mono text-[13px] font-bold ${sub.level ? e3v37LevelTextClass(sub.level) : "text-olive"}`}>
          {sub.score ?? "-"}
        </span>
        <span className={`w-14 text-right text-[11.5px] font-semibold ${sub.level ? e3v37LevelTextClass(sub.level) : "text-olive"}`}>
          {sub.level ?? "-"}
        </span>
      </button>
      {/* 逐题明细（默认折叠） */}
      {hasItems && expanded && (
        <table className="w-full border-collapse border-t border-border text-[12.5px]">
          <thead>
            <tr className="bg-cream-deep/50 text-[11px] text-olive-mute">
              <th className="px-3 py-1.5 text-left font-medium">题目</th>
              <th className="w-28 px-2 py-1.5 text-center font-medium">作答（原答案）</th>
              <th className="w-16 px-2 py-1.5 text-center font-medium">得分（换算）</th>
              <th className="w-16 px-2 py-1.5 text-center font-medium">判定</th>
            </tr>
          </thead>
          <tbody>
            {qItems.map((it) => (
              <tr key={it.no} className={it.level !== "正常" ? "bg-[#fbe3df]/30" : ""}>
                <td className="border-t border-border px-3 py-1.5 text-olive-soft">
                  <span className="mono text-[11px] text-olive-mute">{it.no}.</span>{" "}
                  <span className="font-medium">{it.kp}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-olive-mute">{it.text}</span>
                </td>
                <td className="border-t border-border px-2 py-1.5 text-center text-[12px] text-olive-soft">
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
                <td className={`border-t border-border px-2 py-1.5 text-center mono text-[12px] font-semibold ${e3v37LevelTextClass(it.level)}`}>
                  {it.score}
                </td>
                <td className={`border-t border-border px-2 py-1.5 text-center text-[11px] font-semibold ${e3v37LevelTextClass(it.level)}`}>
                  {it.level}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
  /* V63：逐题明细默认全部折叠，点能力行展开 */
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const coreScore = (sys: string) => e3.systems.core.find((c) => c.key === sys)?.score;
  const groupOf = (label: string): E3V37System =>
    label === "条件" ? "条件" : label === "学能" ? "学能" : (label as E3V37System);
  const group = (label: string, subs: SubRow[], groupNote?: string) => (
    <div key={label} className="mt-3 first:mt-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[13.5px] font-bold text-olive">{label}</span>
        {coreScore(label) != null && <span className="mono text-[12px] font-semibold text-olive-soft">{coreScore(label)}/5</span>}
        {groupNote && <span className="text-[11px] text-olive-mute">{groupNote}</span>}
      </div>
      <div className="mt-1.5 space-y-1.5">
        {subs.map((s) => (
          <AbilityGroup
            key={s.key}
            sub={s}
            items={items}
            systemOf={() => groupOf(label)}
            expanded={open.has(`${label}:${s.key}`)}
            onToggle={() => toggle(`${label}:${s.key}`)}
          />
        ))}
      </div>
    </div>
  );
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">附录 · 三阶九能观察点得分表</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">
        每能一行小计（分数+判定）直接可看；点能力行展开该能逐题明细：作答是你选的原答案（1=从不 / 2=很少 / 3=有时 / 4=经常 / 5=总是），得分按 5 分制换算（反向题已换算，越低越需关注）：{E3V37_LEVEL_CAPTION}。
        {items.length === 0 && "（本次记录未保存逐题作答，仅显示能级小计；重新完成一次诊断即可看到逐题明细。）"}
      </p>
      <div className="mt-3">
        {group("乐学", e3.abilities.filter((a) => a.system === "乐学").map((a) => ({ key: a.key, label: a.label, score: a.score, level: a.level })))}
        {group("会学", e3.abilities.filter((a) => a.system === "会学").map((a) => ({ key: a.key, label: a.label, score: a.score, level: a.level })))}
        {group("善学", e3.abilities.filter((a) => a.system === "善学").map((a) => ({ key: a.key, label: a.label, score: a.score, level: a.level })))}
        {group("条件", e3.systems.condition.cells.map((c) => ({ key: c.key, label: c.label, score: c.score, level: c.level })), "单独报告不进总分")}
        {group("学能", e3.aptitude.map((a) => ({ key: a.key, label: a.label, score: a.score, level: a.level, note: "单独报告不进总分" })), "单独报告不进总分")}
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-olive-mute">
        学能三项（注意力/工作记忆/加工速度）反映当前加工效率，单独报告不进总分，不是智力、也不代表潜力上限；条件系统（状态/关系/资源）同样单独报告。
      </p>
    </div>
  );
}
