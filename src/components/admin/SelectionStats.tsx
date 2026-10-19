/**
 * v220.4 选科统计分析：年级分析 / 班级分析 / 第一推荐分析 / 三轮对比。
 * 数据来源：school.stats.selection（每生：班级 + 加权版/纯测评版双口径组合 + 各轮最新意向）。
 * 设计口径（与策划方案 12.3–12.6 对齐）：
 * - 分布层只显示人数比例，名单在班级视图点进组合可见；
 * - 意向口径优先（家长/学生已提交的轮次），未提交回落到系统推荐口径；
 * - 第一推荐分析用「成绩加权版」为主口径，无成绩学生回落纯测评版并标注。
 */
import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../api/router";
import { trpc } from "@/providers/trpc";
import { G, Card, SecTitle, Pill, RowBar } from "./SchoolConsole";

type Selection = inferRouterOutputs<AppRouter>["school"]["stats"]["selection"];
type Row = Selection["rows"][number];
type Combo = NonNullable<Row["comboWeighted"]>;

const COMBO_LABEL = (subs: string[]) => subs.join("+");
const ALL_SUBJECTS = ["物理", "历史", "化学", "生物", "政治", "地理"];
const RESELECT = ["化学", "生物", "政治", "地理"];
const CLASS_SIZE = 40;

/** 意向口径：最新一轮意向的组合；未提交 → 回落加权推荐。 */
function intentCombo(r: Row): string[] | null {
  const latest = r.intentions.length ? r.intentions.reduce((a, b) => (a.roundNo >= b.roundNo ? a : b)) : null;
  if (latest && latest.subjects?.length === 3) return latest.subjects;
  return r.comboWeighted?.rec1 ?? r.comboSurvey?.rec1 ?? null;
}
function recommendCombo(r: Row): string[] | null {
  return r.comboWeighted?.rec1 ?? r.comboSurvey?.rec1 ?? null;
}
const sameCombo = (a: string[] | null, b: string[] | null) => !!a && !!b && COMBO_LABEL(a) === COMBO_LABEL(b);

function countBy<T>(list: T[], key: (x: T) => string | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of list) {
    const k = key(x);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

/* ------------------------------- 年级分析 ------------------------------- */

function GradeView({ rows }: { rows: Row[] }) {
  const [mode, setMode] = useState<"intent" | "recommend">("intent");
  const comboOf = (r: Row) => (mode === "intent" ? intentCombo(r) : recommendCombo(r));
  const dist = countBy(rows, (r) => {
    const c = comboOf(r);
    return c ? COMBO_LABEL(c) : null;
  });
  const decided = rows.filter((r) => comboOf(r)).length;
  const phys = rows.filter((r) => (comboOf(r)?.[0] ?? "") === "物理").length;
  const hist = rows.filter((r) => (comboOf(r)?.[0] ?? "") === "历史").length;
  /* 班级对比矩阵 */
  const classes = [...new Set(rows.map((r) => r.className ?? "未分班"))].sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
  const matrix = classes.map((c) => {
    const inCls = rows.filter((r) => (r.className ?? "未分班") === c);
    const p = inCls.filter((r) => (comboOf(r)?.[0] ?? "") === "物理").length;
    const top = [...countBy(inCls, (r) => { const x = comboOf(r); return x ? COMBO_LABEL(x) : null; }).entries()].sort((a, b) => b[1] - a[1])[0];
    return { cls: c, n: inCls.length, phys: p, top };
  });
  /* 师资与开班测算 */
  const perSubject = ALL_SUBJECTS.map((s) => ({ s, n: rows.filter((r) => comboOf(r)?.includes(s)).length }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill active={mode === "intent"} onClick={() => setMode("intent")}>意向口径{/* 家长/学生已提交的选科意向 */}</Pill>
        <Pill active={mode === "recommend"} onClick={() => setMode("recommend")}>测评推荐口径</Pill>
        <span className="ml-auto text-[11.5px]" style={{ color: G.mute }}>意向口径：未提交意向的学生回落到系统第一推荐</span>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { n: `${rows.length}`, label: "校园学生总数" },
          { n: `${decided}`, label: mode === "intent" ? "有意向/推荐人数" : "有推荐人数" },
          { n: `${pct(phys, decided)}%`, label: "物理方向倾向" },
          { n: `${pct(hist, decided)}%`, label: "历史方向倾向" },
        ].map((c) => (
          <Card key={c.label}>
            <div className="text-[26px] font-bold" style={{ color: G.brand }}>{c.n}</div>
            <div className="mt-0.5 text-[12px]" style={{ color: G.mute }}>{c.label}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SecTitle title={`组合分布（${decided} 人有结论）`} note="粤华版五大组合" />
          <div className="space-y-2.5">
            {[...dist.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <RowBar key={k} label={k} n={n} total={decided || 1} />
            ))}
            {!dist.size && <p className="text-[12.5px]" style={{ color: G.mute }}>暂无人完成测评或提交意向。</p>}
          </div>
        </Card>
        <Card>
          <SecTitle title="师资与开班测算" note={`按 ${CLASS_SIZE} 人/班折算，仅辅助决策`} />
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left" style={{ color: G.mute }}>
                <th className="py-1.5 font-medium">科目</th>
                <th className="py-1.5 text-right font-medium">选择人数</th>
                <th className="py-1.5 text-right font-medium">占比</th>
                <th className="py-1.5 text-right font-medium">建议教学班</th>
              </tr>
            </thead>
            <tbody>
              {perSubject.map(({ s, n }) => (
                <tr key={s} className="border-t" style={{ borderColor: G.line }}>
                  <td className="py-2 font-semibold" style={{ color: G.ink }}>{s}</td>
                  <td className="py-2 text-right" style={{ color: G.ink }}>{n}</td>
                  <td className="py-2 text-right" style={{ color: G.mute }}>{pct(n, decided)}%</td>
                  <td className="py-2 text-right font-semibold" style={{ color: G.brand }}>{n ? Math.ceil(n / CLASS_SIZE) : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px]" style={{ color: G.mute }}>口径：以当前所选口径的组合统计每科被选人数；教学班按 {CLASS_SIZE} 人/班向上取整。</p>
        </Card>
      </div>
      <Card>
        <SecTitle title="班级对比矩阵" note="一屏看班际差异：物化强班 vs 文史强班" />
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left" style={{ color: G.mute }}>
              <th className="py-1.5 font-medium">班级</th>
              <th className="py-1.5 text-right font-medium">人数</th>
              <th className="py-1.5 text-right font-medium">物理方向</th>
              <th className="py-1.5 text-right font-medium">历史方向</th>
              <th className="py-1.5 font-medium">TOP1 组合</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((m) => (
              <tr key={m.cls} className="border-t" style={{ borderColor: G.line }}>
                <td className="py-2 font-semibold" style={{ color: G.ink }}>{m.cls}</td>
                <td className="py-2 text-right" style={{ color: G.ink }}>{m.n}</td>
                <td className="py-2 text-right font-semibold" style={{ color: m.n && m.phys / m.n >= 0.6 ? G.brand : G.ink }}>
                  {m.n ? `${m.phys} 人 · ${pct(m.phys, m.n)}%` : "—"}
                </td>
                <td className="py-2 text-right" style={{ color: G.ink }}>{m.n ? `${m.n - m.phys} 人 · ${pct(m.n - m.phys, m.n)}%` : "—"}</td>
                <td className="py-2" style={{ color: m.top ? G.ink : G.mute }}>{m.top ? `${m.top[0]}（${m.top[1]}人）` : "暂无"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ------------------------------- 班级分析 ------------------------------- */

function ClassView({ rows, showNames }: { rows: Row[]; showNames: boolean }) {
  const classes = [...new Set(rows.map((r) => r.className ?? "未分班"))].sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
  const [cls, setCls] = useState("");
  const active = cls || classes[0] || "";
  const inCls = rows.filter((r) => (r.className ?? "未分班") === active);
  const n = inCls.length;
  const gradeN = rows.length;
  const phys = inCls.filter((r) => (intentCombo(r)?.[0] ?? "") === "物理").length;
  const gradePhys = rows.filter((r) => (intentCombo(r)?.[0] ?? "") === "物理").length;
  const subjectStat = RESELECT.map((s) => ({
    s,
    n: inCls.filter((r) => intentCombo(r)?.includes(s)).length,
    g: rows.filter((r) => intentCombo(r)?.includes(s)).length,
  }));
  const dist = countBy(inCls, (r) => { const c = intentCombo(r); return c ? COMBO_LABEL(c) : null; });
  const sorted = [...dist.entries()].sort((a, b) => b[1] - a[1]);
  const [openCombo, setOpenCombo] = useState<string | null>(null);
  if (!classes.length) return <Card><p className="text-[13px]" style={{ color: G.mute }}>暂无校园学生数据。</p></Card>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {classes.map((c) => (
          <Pill key={c} active={active === c} onClick={() => { setCls(c); setOpenCombo(null); }}>{c}</Pill>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { n: `${n}`, label: `${active} 学生数` },
          { n: `${pct(phys, n)}%`, label: "物理方向倾向" },
          { n: `${pct(gradePhys, gradeN)}%`, label: "年级物理平均" },
          { n: sorted[0] ? sorted[0][0] : "—", label: "本班 TOP1 组合" },
        ].map((c) => (
          <Card key={c.label}>
            <div className="text-[22px] font-bold" style={{ color: G.brand }}>{c.n}</div>
            <div className="mt-0.5 text-[12px]" style={{ color: G.mute }}>{c.label}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SecTitle title="首选科目倾向" note={`本班 vs 年级平均（${pct(gradePhys, gradeN)}%）`} />
          <div className="space-y-2.5">
            <RowBar label="物理" n={phys} total={n || 1} />
            <RowBar label="历史" n={n - phys} total={n || 1} color="#D9A13B" />
          </div>
          <p className="mt-2 text-[11.5px]" style={{ color: G.mute }}>
            {n ? (phys / n >= gradePhys / Math.max(gradeN, 1) ? "本班物理倾向高于年级平均。" : "本班物理倾向低于年级平均。") : ""}
          </p>
        </Card>
        <Card>
          <SecTitle title="再选四科选择率" note="超年级平均的组合在数值后标注" />
          <div className="space-y-2.5">
            {subjectStat.map(({ s, n: cn, g }) => (
              <div key={s}>
                <RowBar label={s} n={cn} total={n || 1} />
                <div className="mt-0.5 text-[10.5px]" style={{ color: G.mute }}>
                  年级 {g} 人 · {pct(g, gradeN)}%{cn / Math.max(n, 1) > g / Math.max(gradeN, 1) ? " · 本班偏高" : cn / Math.max(n, 1) < g / Math.max(gradeN, 1) ? " · 本班偏低" : ""}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <SecTitle title="组合分布" note="点一行可查看名单（按权限可见）" />
        <div className="space-y-2">
          {sorted.map(([k, cn], i) => (
            <div key={k}>
              <button
                type="button"
                disabled={!showNames}
                onClick={() => setOpenCombo(openCombo === k ? null : k)}
                className="w-full text-left"
              >
                <RowBar label={`${i < 3 ? "★ " : ""}${k}`} n={cn} total={n || 1} color={i < 3 ? undefined : "#9BB3A7"} />
              </button>
              {showNames && openCombo === k && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-lg p-2.5" style={{ background: G.brandSoft }}>
                  {inCls.filter((r) => sameCombo(intentCombo(r), k.split("+"))).map((r) => (
                    <span key={r.userId} className="rounded-full bg-white px-2 py-0.5 text-[11.5px] font-medium" style={{ color: G.ink }}>
                      {r.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!sorted.length && <p className="text-[12.5px]" style={{ color: G.mute }}>本班暂无人完成测评或提交意向。</p>}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------- 第一推荐分析 ------------------------------- */

function diffNote(w: Combo | null, sv: Combo | null): string {
  if (!w || !sv) return "数据不足";
  if (COMBO_LABEL(w.rec1) === COMBO_LABEL(sv.rec1)) return "两版一致";
  if (w.winTrack !== sv.winTrack) return w.tied || sv.tied ? `首选方向持平，按数学成绩（${w.mathScore ?? "未录入"} 分）裁定` : "成绩加权后首选方向改变";
  const diffSubs = w.rec1.filter((s) => !sv.rec1.includes(s));
  return `成绩加权后再选科目调整（${diffSubs.join("、") || "组合"}）`;
}

function RecommendView({ rows }: { rows: Row[] }) {
  const withCombo = rows.filter((r) => r.comboWeighted || r.comboSurvey);
  const dist = countBy(withCombo, (r) => { const c = recommendCombo(r); return c ? COMBO_LABEL(c) : null; });
  const sorted = [...dist.entries()].sort((a, b) => b[1] - a[1]);
  const disagree = withCombo.filter((r) => r.comboWeighted && r.comboSurvey && COMBO_LABEL(r.comboWeighted.rec1) !== COMBO_LABEL(r.comboSurvey.rec1));
  const conflict = withCombo.filter((r) => {
    const rec = recommendCombo(r);
    const it = r.intentions.length ? r.intentions.reduce((a, b) => (a.roundNo >= b.roundNo ? a : b)) : null;
    return rec && it && COMBO_LABEL(it.subjects) !== COMBO_LABEL(rec);
  });
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 text-white" style={{ background: G.deep }}>
        <div className="text-[11px] opacity-80">总结论（自动生成）</div>
        <div className="mt-1 text-[15.5px] font-bold leading-relaxed">
          {withCombo.length === 0
            ? "暂无完成学科四维的学生——第一推荐需先完成测评。"
            : `已有 ${withCombo.length} 人产出第一推荐（成绩加权版为主口径${rows.filter((r) => !r.hasGrades && r.comboSurvey).length ? `，其中 ${rows.filter((r) => !r.hasGrades && r.comboSurvey).length} 人未录成绩、按纯测评版` : ""}）；两版不一致 ${disagree.length} 人、推荐×意向冲突 ${conflict.length} 人。`}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SecTitle title="第一推荐 TOP 排行" note={`${withCombo.length} 人有推荐`} />
          <div className="space-y-2.5">
            {sorted.map(([k, n], i) => (
              <RowBar key={k} label={`${i < 3 ? "★ " : ""}${k}`} n={n} total={withCombo.length || 1} color={i < 3 ? undefined : "#9BB3A7"} />
            ))}
            {!sorted.length && <p className="text-[12.5px]" style={{ color: G.mute }}>暂无数据。</p>}
          </div>
        </Card>
        <Card>
          <SecTitle title="两版不一致名单" note={`${disagree.length} 人 · 班主任面谈优先清单`} />
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {disagree.map((r) => (
              <div key={r.userId} className="rounded-lg border p-2.5" style={{ borderColor: G.line }}>
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <b style={{ color: G.ink }}>{r.name}</b>
                  {r.className && <span className="text-[11px]" style={{ color: G.mute }}>{r.className}</span>}
                  {!r.hasGrades && <span className="rounded-full px-1.5 text-[10.5px]" style={{ background: G.brandSoft, color: G.brand }}>未录成绩</span>}
                </div>
                <div className="mt-1 text-[12px]" style={{ color: G.mute }}>
                  测评版 <b style={{ color: G.ink }}>{COMBO_LABEL(r.comboSurvey!.rec1)}</b> → 加权版 <b style={{ color: G.brand }}>{COMBO_LABEL(r.comboWeighted!.rec1)}</b>
                  <span className="ml-1">（{diffNote(r.comboWeighted, r.comboSurvey)}）</span>
                </div>
              </div>
            ))}
            {!disagree.length && <p className="text-[12.5px]" style={{ color: G.mute }}>当前两版推荐全部一致。</p>}
          </div>
        </Card>
      </div>
      <Card>
        <SecTitle title="推荐 × 意向冲突名单" note={`${conflict.length} 人 · 已提交意向且与系统第一推荐不同`} />
        {conflict.length ? (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left" style={{ color: G.mute }}>
                <th className="py-1.5 font-medium">学生</th>
                <th className="py-1.5 font-medium">班级</th>
                <th className="py-1.5 font-medium">系统第一推荐</th>
                <th className="py-1.5 font-medium">家庭意向</th>
                <th className="py-1.5 font-medium">差异</th>
              </tr>
            </thead>
            <tbody>
              {conflict.map((r) => {
                const it = r.intentions.reduce((a, b) => (a.roundNo >= b.roundNo ? a : b));
                const recFirst = recommendCombo(r)?.[0] ?? "";
                return (
                  <tr key={r.userId} className="border-t" style={{ borderColor: G.line }}>
                    <td className="py-2 font-semibold" style={{ color: G.ink }}>{r.name}</td>
                    <td className="py-2" style={{ color: G.mute }}>{r.className ?? "—"}</td>
                    <td className="py-2" style={{ color: G.ink }}>{COMBO_LABEL(recommendCombo(r)!)}</td>
                    <td className="py-2" style={{ color: G.ink }}>{it.subjects.join("+")}{it.choice === "custom" ? "（自定义）" : ""}</td>
                    <td className="py-2" style={{ color: (recFirst === "物理") !== (it.subjects[0] === "物理") ? G.danger : G.warn }}>
                      {(recFirst === "物理") !== (it.subjects[0] === "物理") ? "首选方向不同" : "再选科目不同"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-[12.5px]" style={{ color: G.mute }}>暂无冲突：已提交意向的学生均与系统第一推荐一致。</p>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------- 三轮对比 ------------------------------- */

function RoundsView({ rows, rounds }: { rows: Row[]; rounds: Selection["rounds"] }) {
  const list = rounds.length ? rounds : [{ roundNo: 1, label: "第一轮意向", status: "open" as const }];
  const [roundNo, setRoundNo] = useState(list[0]!.roundNo);
  const round = list.find((r) => r.roundNo === roundNo) ?? list[0]!;
  const submitted = rows.filter((r) => r.intentions.some((i) => i.roundNo === round.roundNo));
  const sway = submitted.filter((r) => {
    const it = r.intentions.find((i) => i.roundNo === round.roundNo)!;
    return r.edits > 1 || !sameCombo(it.subjects, recommendCombo(r));
  });
  const CHOICE_LABEL: Record<string, string> = { rec1: "推荐1", rec2: "推荐2", rec3: "推荐3", custom: "自定义" };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {list.map((r) => (
          <Pill key={r.roundNo} active={round.roundNo === r.roundNo} onClick={() => setRoundNo(r.roundNo)}>
            第{r.roundNo}轮{r.status === "open" ? "·开放中" : ""}
          </Pill>
        ))}
        <span className="ml-auto text-[11.5px]" style={{ color: G.mute }}>意向 ≠ 最终决定，仅供教学计划参考</span>
      </div>
      <div className="rounded-xl p-4 text-white" style={{ background: G.deep }}>
        <div className="text-[11px] opacity-80">第{round.roundNo}轮（{round.label}）结构对比</div>
        <div className="mt-1 text-[15.5px] font-bold leading-relaxed">
          {submitted.length} 人提交意向 / {rows.length} 人；其中摇摆学生（修改过或背离推荐）{sway.length} 人。
        </div>
      </div>
      <Card>
        <SecTitle title={`测评推荐 vs 第${round.roundNo}轮意向 · 逐人对照`} note={`已提交 ${submitted.length} 人`} />
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left" style={{ color: G.mute }}>
                <th className="py-1.5 pr-3 font-medium">学生</th>
                <th className="py-1.5 pr-3 font-medium">班级</th>
                <th className="py-1.5 pr-3 font-medium">测评第一推荐</th>
                <th className="py-1.5 pr-3 font-medium">第{round.roundNo}轮意向</th>
                <th className="py-1.5 pr-3 font-medium">一致</th>
                <th className="py-1.5 font-medium">修改次数</th>
              </tr>
            </thead>
            <tbody>
              {[...submitted]
                .sort((a, b) => Number(sway.includes(b)) - Number(sway.includes(a)))
                .map((r) => {
                  const it = r.intentions.find((i) => i.roundNo === round.roundNo)!;
                  const ok = sameCombo(it.subjects, recommendCombo(r));
                  const isSway = sway.includes(r);
                  return (
                    <tr key={r.userId} className="border-t" style={{ borderColor: G.line, background: isSway ? "#FBF6EC" : undefined }}>
                      <td className="py-2 pr-3 font-semibold" style={{ color: G.ink }}>{r.name}</td>
                      <td className="py-2 pr-3" style={{ color: G.mute }}>{r.className ?? "—"}</td>
                      <td className="py-2 pr-3" style={{ color: G.ink }}>{recommendCombo(r) ? COMBO_LABEL(recommendCombo(r)!) : "未测评"}</td>
                      <td className="py-2 pr-3" style={{ color: G.ink }}>
                        {it.subjects.join("+")}
                        <span className="ml-1 text-[10.5px]" style={{ color: G.mute }}>{CHOICE_LABEL[it.choice] ?? it.choice}</span>
                      </td>
                      <td className="py-2 pr-3 font-bold" style={{ color: ok ? G.brand : G.warn }}>{ok ? "✅" : "⚠️"}</td>
                      <td className="py-2" style={{ color: r.edits > 1 ? G.warn : G.mute }}>{r.edits > 1 ? `${r.edits} 次` : "—"}</td>
                    </tr>
                  );
                })}
              {!submitted.length && (
                <tr><td colSpan={6} className="py-6 text-center" style={{ color: G.mute }}>本轮暂无人提交意向。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------- 主组件 ------------------------------- */

export default function SelectionStats({ canManage }: { canManage: boolean }) {
  const [view, setView] = useState<"grade" | "class" | "recommend" | "rounds">("grade");
  const { data, isLoading } = trpc.school.stats.selection.useQuery();
  const rows = data?.rows ?? [];
  const VIEWS = [
    { key: "grade", label: "年级分析" },
    { key: "class", label: "班级分析" },
    { key: "recommend", label: "第一推荐分析" },
    { key: "rounds", label: "三轮对比" },
  ] as const;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Pill key={v.key} active={view === v.key} onClick={() => setView(v.key)}>{v.label}</Pill>
        ))}
      </div>
      {isLoading ? (
        <p className="text-[13px]" style={{ color: G.mute }}>加载中…</p>
      ) : !rows.length ? (
        <Card><p className="text-[13px]" style={{ color: G.mute }}>暂无校园学生数据。</p></Card>
      ) : view === "grade" ? (
        <GradeView rows={rows} />
      ) : view === "class" ? (
        <ClassView rows={rows} showNames={canManage} />
      ) : view === "recommend" ? (
        <RecommendView rows={rows} />
      ) : (
        <RoundsView rows={rows} rounds={data?.rounds ?? []} />
      )}
    </div>
  );
}
