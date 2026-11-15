/**
 * v289 家长 DISC 双人对照读本：爸爸 × 妈妈。
 *
 * 场景：同一件事，两个人给的答法不一样——不是谁对谁错，是两种节奏撞在一起。
 * 但原来只能一人一本，谁也看不见另一本，于是「统一口径」变成「各说各的」。
 *
 * 内容来源与单本完全一致：`buildCommKit({ parents: [一位] })` 的「家长个人版」七节原话，
 * 两位各取一份，按节对齐后上下并列。本文件不新增任何沟通建议文案，
 * 只做三件事：并排四维、对齐七节、把差值算出来。
 *
 * 三处共用：后台抽屉「与另一位家长对照」、/pd-report 打印页（服务端出 PDF）。
 */
import { useMemo } from "react";
import { ArrowRight, Download, Users } from "lucide-react";
import { DISC_ANIMAL, DISC_REPORTS, getDiscCombo } from "@/data/reports";
import { buildCommKit, type KitSection } from "@contracts/familyCommKit";
import { discTendencyFromDims, type DiscResult } from "@contracts/assessments";
import { KitBlockView } from "@/components/reports/FamilyCommKit";

const DIMS = ["D", "I", "S", "C"] as const;
const DIM_NAME = { D: "支配", I: "影响", S: "稳健", C: "谨慎" } as const;

/** 两个人的颜色：主导方深青，另一方赭黄——与单本读本的品牌色同族，不引入新色。 */
const TONE = [
  { bar: "#0C7064", soft: "#E7F1EC", text: "#0C7064" },
  { bar: "#C08A2E", soft: "#F7F2E4", text: "#8A6500" },
] as const;

type Side = { label: string; result: DiscResult };

type Props = {
  a: Side;
  b: Side;
  printMode?: boolean;
  onExport?: () => void;
  exporting?: boolean;
  metaText?: string;
};

/** 一侧的全部派生量：类型、副维、绝对分、倾向度、七节内容 */
function useSide(side: Side, index: 0 | 1) {
  return useMemo(() => {
    const { result, label } = side;
    const combo = getDiscCombo(result.dims);
    const primary = result.primary;
    const secondary =
      combo[1] ?? [...DIMS].sort((x, y) => result.dims[y] - result.dims[x]).find((d) => d !== primary) ?? primary;
    const total = result.version === 2 ? 24 : 12;
    const pct = Object.fromEntries(
      DIMS.map((d) => [d, Math.round((result.dims[d] / total) * 100)]),
    ) as Record<(typeof DIMS)[number], number>;
    const tendency = discTendencyFromDims(result.dims, result.version);
    const kit = buildCommKit({ parents: [{ label, result }] });
    const book = kit.books.find((bk) => bk.key === "parent" && bk.ready) ?? null;
    const rankedDims = [...DIMS].sort((x, y) => pct[y] - pct[x]);
    return {
      label,
      result,
      tone: TONE[index],
      combo,
      primary,
      secondary,
      report: DISC_REPORTS[primary],
      animal: DISC_ANIMAL[primary],
      pct,
      tendency,
      book,
      strongest: rankedDims[0],
      weakest: rankedDims[rankedDims.length - 1],
    };
  }, [side, index]);
}

type Derived = ReturnType<typeof useSide>;

export default function ParentDiscCompare({ a, b, printMode = false, onExport, exporting = false, metaText }: Props) {
  const A = useSide(a, 0);
  const B = useSide(b, 1);

  /* 差值：按绝对值排，谁在哪一维更用力一眼看出来 */
  const diff = useMemo(
    () =>
      DIMS.map((d) => ({ d, av: A.pct[d], bv: B.pct[d], delta: A.pct[d] - B.pct[d] })).sort(
        (x, y) => Math.abs(y.delta) - Math.abs(x.delta),
      ),
    [A.pct, B.pct],
  );
  const widest = diff[0];
  const biggest = Math.abs(widest.delta);
  const lead = widest.delta > 0 ? A : B;
  const trail = widest.delta > 0 ? B : A;

  /* 七节对齐：同一份引擎出的书，节数与顺序一致；万一不一致按较长的走 */
  const rows = useMemo(() => {
    const sa: KitSection[] = A.book?.sections ?? [];
    const sb: KitSection[] = B.book?.sections ?? [];
    const n = Math.max(sa.length, sb.length);
    return Array.from({ length: n }, (_, i) => ({ key: sa[i]?.no ?? sb[i]?.no ?? String(i + 1), a: sa[i], b: sb[i] }));
  }, [A.book, B.book]);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-4">
      {/* ---------------- 封面：两个人的形状先摆在一起 ---------------- */}
      <section className="paper-card overflow-hidden p-5 sm:p-7">
        <div className="flex items-center gap-1.5">
          {["#0C7064", "#C08A2E", "#52A965"].map((c, i) => (
            <span
              key={c}
              className="rounded-full"
              style={{ background: c, width: i === 1 ? 10 : 8, height: i === 1 ? 10 : 8 }}
            />
          ))}
        </div>
        <p className="mono mt-5 text-[10.5px] uppercase tracking-[0.22em] text-olive-mute">
          FOR PARENTS ONLY · TWO PROFILES, ONE HOUSE
        </p>
        <h2 className="mt-2 text-[26px] font-black leading-tight tracking-tight text-olive sm:text-[32px]">
          {A.label}和{B.label}，不是同一种家长
        </h2>
        <div className="mt-3 h-[3px] w-14 rounded-full bg-brand" />
        <p className="mt-3 text-[13.5px] leading-relaxed text-olive-soft">
          {A.label}是 <b className="text-olive">{A.combo.join("")} 型</b>
          {A.report ? ` · ${A.report.name}` : ""}，{A.animal}为主；
          {B.label}是 <b className="text-olive">{B.combo.join("")} 型</b>
          {B.report ? ` · ${B.report.name}` : ""}，{B.animal}为主。
          这本不评谁对，只把两种节奏摆在一起，让你们看见孩子每天接的是两套信号。
        </p>

        {/* 两人各一张小卡 */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[A, B].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border/70 bg-white px-3.5 py-3"
              style={{ borderLeft: `3px solid ${s.tone.bar}` }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[14px] font-bold text-olive">{s.label}</p>
                <span className="mono text-[11px]" style={{ color: s.tone.text }}>
                  {s.combo.join("")} 型
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-olive-mute">
                主导 {s.primary}（{DIM_NAME[s.primary]} {s.pct[s.primary]}）· 副维 {s.secondary}（
                {DIM_NAME[s.secondary]} {s.pct[s.secondary]}）
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-olive-soft">
                最弱一格是 {s.weakest}（{DIM_NAME[s.weakest]} {s.pct[s.weakest]}）——这一维上的话，他往往说不出口。
              </p>
            </div>
          ))}
        </div>

        {/* 四维并排：同一维两根条，长的那个就是「谁在这件事上更用力」 */}
        <div className="mt-4 rounded-xl border border-border/70 bg-white px-3.5 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[11.5px] text-olive-mute">四个维度对照（0—100 绝对分，四维合计不固定为 100）</p>
            <div className="flex items-center gap-2.5">
              {[A, B].map((s) => (
                <span key={s.label} className="flex items-center gap-1 text-[10.5px] text-olive-mute">
                  <i className="inline-block h-2 w-2 rounded-sm" style={{ background: s.tone.bar }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {DIMS.map((d) => (
              <div key={d} className="flex items-center gap-2.5">
                <span className="w-[52px] shrink-0 text-[12.5px] text-olive">
                  {d} {DIM_NAME[d]}
                </span>
                <div className="flex-1 space-y-1">
                  {[A, B].map((s) => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-deep">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(3, s.pct[d]))}%`,
                            background: s.tone.bar,
                          }}
                        />
                      </div>
                      <span className="mono w-6 shrink-0 text-right text-[11px] text-olive">{s.pct[d]}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-border/50 pt-2 text-[12px] leading-relaxed text-olive-soft">
            差得最多的是 <b className="text-olive">{widest.d}</b>（{DIM_NAME[widest.d]}）：
            {lead.label} {lead.pct[widest.d]}，{trail.label} {trail.pct[widest.d]}，相差{" "}
            <b className="text-olive">{biggest}</b> 分。这一维就是你们最容易各说各话的地方——
            不是谁错了，是两个人对「{DIM_GAP[widest.d]}」的默认答案不一样。
          </p>
        </div>

        <div className="mt-4 rounded-xl bg-brand-pale/45 px-4 py-1.5">
          <div className="flex gap-3 border-b border-border/40 py-2 text-[12px]">
            <span className="w-[68px] shrink-0 text-olive-mute">这份给谁</span>
            <span className="flex-1 font-semibold leading-relaxed text-olive">
              {A.label}和{B.label}一起看。不是拿去找对方算账，是先知道「他怎么会那样说」。
            </span>
          </div>
          <div className="flex gap-3 border-b border-border/40 py-2 text-[12px]">
            <span className="w-[68px] shrink-0 text-olive-mute">怎么来的</span>
            <span className="flex-1 font-semibold leading-relaxed text-olive">
              两个人各自做的 24 组二选一，各折一份四维分；下面的七节是各自那本的原文，没改写。
            </span>
          </div>
          <div className="flex gap-3 py-2 text-[12px]">
            <span className="w-[68px] shrink-0 text-olive-mute">怎么读</span>
            <span className="flex-1 font-semibold leading-relaxed text-olive">
              先看第一部分差在哪，再翻第二部分 06 节：同一件事，两人各有一句话，挑一句先统一。
            </span>
          </div>
        </div>
        {metaText && <p className="mt-3 text-[11.5px] text-olive-mute">{metaText}</p>}
      </section>

      {/* 段导航（屏幕上才有） */}
      {!printMode && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-cream/95 p-1.5 backdrop-blur print:hidden">
          <button
            onClick={() => go("pdc-part-1")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-olive-soft transition-colors hover:bg-white hover:text-olive"
          >
            <span className="mono text-[11px] text-brand">01</span> 你们差在哪
          </button>
          <ArrowRight size={12} className="text-olive-mute" />
          <button
            onClick={() => go("pdc-part-2")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-olive-soft transition-colors hover:bg-white hover:text-olive"
          >
            <span className="mono text-[11px] text-brand">02</span> 同一个问题，两种答法
          </button>
          {onExport && (
            <button
              onClick={onExport}
              disabled={exporting}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-50"
            >
              <Download size={13} />
              {exporting ? "正在生成 PDF…" : "导出 PDF"}
            </button>
          )}
        </div>
      )}

      {/* ---------------- 第一部分：差值在哪 ---------------- */}
      <section id="pdc-part-1" className="scroll-mt-16 space-y-3">
        <PartHead
          no="第一部分"
          title="你们差在哪"
          note={`${A.label} ${A.combo.join("")} · ${B.label} ${B.combo.join("")}`}
        />
        <p className="px-1 text-[13.5px] leading-relaxed text-olive-soft">
          下面这张表把两个人的四个维度并排放，差值取「{A.label} − {B.label}」。
          先看清差在哪一维，再看这一维在生活里怎么变成两种说法。
        </p>

        <div className="paper-card p-5 print:break-inside-avoid">
          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-cream-deep/70 text-olive">
                  <th className="px-3 py-2 text-left font-semibold">维度</th>
                  <th className="px-3 py-2 text-right font-semibold">{A.label}</th>
                  <th className="px-3 py-2 text-right font-semibold">{B.label}</th>
                  <th className="px-3 py-2 text-right font-semibold">差值</th>
                  <th className="px-3 py-2 text-left font-semibold">这一维管什么</th>
                </tr>
              </thead>
              <tbody>
                {diff.map((r) => (
                  <tr key={r.d} className="border-t border-border/50">
                    <td className="px-3 py-1.5 font-semibold text-olive">
                      {r.d} {DIM_NAME[r.d]}
                    </td>
                    <td className="mono px-3 py-1.5 text-right text-olive">{r.av}</td>
                    <td className="mono px-3 py-1.5 text-right text-olive">{r.bv}</td>
                    <td
                      className="mono px-3 py-1.5 text-right font-semibold"
                      style={{ color: r.delta === 0 ? "#6B7A72" : r.delta > 0 ? TONE[0].text : TONE[1].text }}
                    >
                      {r.delta > 0 ? `+${r.delta}` : r.delta}
                    </td>
                    <td className="px-3 py-1.5 text-olive-mute">{DIM_TAG[r.d]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-olive-mute">
            差值只是方向，不是评价。同一维高的人不是「更好」，是他在那一格上更容易先动、先开口；
            低的人也不是「不上心」，是他的默认反应在另外一维上。
          </p>
        </div>

        <div className="rounded-xl border-l-[3px] border-[#C08A2E] bg-[#F7F2E4] px-4 py-3">
          <p className="text-[12.5px] font-bold text-[#8A6500]">两份说明书，一本对话录</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">
            一个人的时候，只能看见自己的那半本；两个人放在一起，才看得见孩子每天在两种节奏之间切换。
            下面第二部分不改写任何一条建议——{A.label}那七节、{B.label}那七节，原文并列，你们自己比对。
          </p>
        </div>
      </section>

      {/* ---------------- 第二部分：七节对齐 ---------------- */}
      <section id="pdc-part-2" className="scroll-mt-16 space-y-3">
        <PartHead no="第二部分" title="同一个问题，两种答法" note="两本原文并列，未改写" />
        <p className="px-1 text-[13.5px] leading-relaxed text-olive-soft">
          每一节是同一个问题。先读{A.label}的，再读{B.label}的。
          你会发现两边都想把孩子往前推，只是推法不一样——这就是孩子听到的「两种口径」。
        </p>

        {rows.length === 0 ? (
          <p className="paper-card p-6 text-center text-[13px] text-olive-mute">
            这两份的作答数据不完整，暂时出不来对照，可以联系老师各重测一次。
          </p>
        ) : (
          rows.map((r) => (
            /* 纸面上不要卡片边框：一节两人常常跨页，卡片被切开很难看，改成细线分区 */
            <section key={r.key} className="paper-card p-5 print:rounded-none print:border-0 print:bg-transparent print:px-0 print:shadow-none">
              <div className="flex items-baseline gap-2 print:break-after-avoid">
                <span className="mono text-[11.5px] text-brand">{r.key}</span>
                <h4 className="text-[15.5px] font-bold text-olive">{r.a?.title ?? r.b?.title ?? ""}</h4>
              </div>
              {r.a?.lead && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-olive-soft print:break-after-avoid">{r.a.lead}</p>
              )}
              <div className="mt-3 space-y-3">
                <SideBlocks s={A} sec={r.a} />
                <SideBlocks s={B} sec={r.b} />
              </div>
            </section>
          ))
        )}

        {/* 结尾：不劝和、不评理，只留一张两人要一起填的表——空白处正好给手写 */}
        <section className="paper-card p-5 print:break-inside-avoid">
          <p className="mono text-[10.5px] tracking-[0.2em] text-olive-mute">NEXT · 两周后对一次</p>
          <h3 className="mt-1.5 flex items-center gap-1.5 text-[17px] font-bold text-olive">
            <Users size={15} className="text-brand" />
            下一步：只统一三件事
          </h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <p className="text-[12.5px] leading-relaxed text-olive-soft">
              不打印给孩子看，也不在餐桌上念给对方听。各自从 06 节挑一句，今晚只用那一句。
            </p>
            <p className="text-[12.5px] leading-relaxed text-olive-soft">
              口径只统一三件就够：几点算晚、作业谁查、犯错先听谁说完。其余差异留着——
              孩子需要两个不一样的大人，只需要两条一致的底线。
            </p>
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border border-border/60">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-cream-deep/70 text-olive">
                  <th className="w-[34%] px-3 py-2 text-left font-semibold">要一起定的事</th>
                  <th className="px-3 py-2 text-left font-semibold">{A.label}</th>
                  <th className="px-3 py-2 text-left font-semibold">{B.label}</th>
                </tr>
              </thead>
              <tbody>
                {["今晚先只用哪一句", "这一周谁先松口", "两周后看到的第一个变化"].map((q) => (
                  <tr key={q} className="border-t border-border/50">
                    <td className="px-3 py-3 text-olive">{q}</td>
                    <td className="px-3 py-7" />
                    <td className="px-3 py-7" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-olive-mute">
            填完把这张纸贴在冰箱上。两周后再翻到 06 节，把「用过的句子」和「实际反应」对照一次——
            两个人对同一件事的说法，差的是这一句。
          </p>

          {/* 留白写字区：这一页本来就该有空间，人在纸上写才记得住 */}
          <div className="mt-4">
            <p className="text-[11.5px] font-semibold text-olive-soft">两周后在这里写：谁说了什么、孩子怎么反应</p>
            <div className="mt-1 space-y-7">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="border-b border-dashed border-border/70" />
              ))}
            </div>
          </div>

          <p className="mt-3 border-t border-border/50 pt-2 text-[11px] leading-relaxed text-olive-mute">
            这份对照只解释性格节奏带来的沟通错位，不含学业诊断与心理评估。所有建议都不做效果承诺；
            涉及边界问题（动手、长期辱骂、威胁、翻手机当众念出）请拨 12355 或联系学校心理老师。
          </p>
        </section>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** 同一维上的两种默认答案——差值那句话按主导维度换词，不写死成 D */
const DIM_GAP = {
  D: "要不要现在就要结果",
  I: "话说在前面，还是先憋着",
  S: "现在改，还是先别动",
  C: "先做对，还是先做完",
} as const;

const DIM_TAG = {
  D: "要结果、要现在、谁说了算",
  I: "要热闹、要回应、话说在前面",
  S: "要稳、要慢、先别变",
  C: "要准、要标准、先看见错",
} as const;

function SideBlocks({ s, sec }: { s: Derived; sec?: KitSection }) {
  return (
    <div className="rounded-lg border border-border/50" style={{ borderLeft: `3px solid ${s.tone.bar}` }}>
      <div className="flex items-baseline gap-2 px-3 pt-2 print:break-after-avoid">
        <span
          className="rounded px-1.5 py-0.5 text-[10.5px] font-bold"
          style={{ background: s.tone.soft, color: s.tone.text }}
        >
          {s.label}
        </span>
        <span className="text-[11px] text-olive-mute">
          {s.combo.join("")} 型 · {s.primary} 主导
        </span>
        {sec && (
          <span className="ml-auto text-[10.5px] text-olive-mute/80">
            {sec.no} {sec.title}
          </span>
        )}
      </div>
      <div className="space-y-2.5 px-3 pb-3 pt-2">
        {sec ? (
          sec.blocks.map((bl, i) => <KitBlockView key={i} b={bl} />)
        ) : (
          <p className="text-[12.5px] text-olive-mute">这一节对方没有对应内容。</p>
        )}
      </div>
    </div>
  );
}

function PartHead({ no, title, note }: { no: string; title: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-[2.5px] border-[#24382F] px-1 pb-2 print:break-after-avoid">
      <div className="flex items-baseline gap-2.5">
        <span className="mono text-[11px] tracking-wider text-olive-mute">{no}</span>
        <h3 className="text-[17px] font-bold text-olive">{title}</h3>
      </div>
      <span className="text-[11.5px] text-olive-mute">{note}</span>
    </div>
  );
}

/* 供测试断言用：说明本书的数据口径没有走新问卷 */
export const COMPARE_NOTE = "两本原文并列，未改写";
