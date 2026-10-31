/**
 * 家庭沟通锦囊 · 报告渲染层（v240）
 *
 * 四本读本共用一套版式：扉页（这份给谁 + 三行说明）→ 若干节。
 * 内容全部由 contracts/familyCommKit.ts 算好，这里只负责摆；
 * 不在渲染层补文案——否则同一份数据在两台机器上会出现两种说法。
 */
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useAssessmentPass } from "@/components/coach/passRequest";
import { buildCommKit, type KitBlock, type KitBook, type KitCoverVisual } from "@contracts/familyCommKit";
import type { DiscResult } from "@contracts/assessments";

type ParentDisc = { label: string; result: DiscResult };

export default function FamilyCommKit({
  disc,
  discParents,
  viewer = "student",
  profile,
}: {
  disc?: DiscResult | null;
  discParents?: ParentDisc[];
  viewer?: "student" | "tutor";
  profile?: { name?: string | null; grade?: string | null };
}) {
  const parents = useMemo<ParentDisc[]>(
    () => (discParents ?? []).filter((p) => p?.result?.dims),
    [discParents],
  );

  const kit = useMemo(
    () =>
      buildCommKit({
        studentName: profile?.name ?? null,
        grade: profile?.grade ?? null,
        disc: disc ?? null,
        parents: parents.map((p) => ({ label: p.label, result: p.result })),
      }),
    [disc, parents, profile?.name, profile?.grade],
  );

  /* 主分段：同一 key 只出现一次（家长个人版可能有两本，走二级切换） */
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, KitBook[]>();
    for (const b of kit.books) {
      if (!map.has(b.key)) {
        map.set(b.key, []);
        order.push(b.key);
      }
      map.get(b.key)!.push(b);
    }
    return order.map((k) => ({ key: k, books: map.get(k)! }));
  }, [kit.books]);

  /* 封面的日期戳：只取一次，避免每次重渲染跳字 */
  const stamp = useMemo(() => {
    const d = new Date();
    return `私人材料 · ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const [groupKey, setGroupKey] = useState<string>("trio");
  const [parentIdx, setParentIdx] = useState(0);

  const group = groups.find((g) => g.key === groupKey) ?? groups[0];
  const book = group.books[Math.min(parentIdx, group.books.length - 1)] ?? group.books[0];

  return (
    <div className="space-y-4">
      {/* 口径声明：这一份与 DISC 详版的数字关系，先说清楚，避免两处看起来打架 */}
      <section className="paper-card accent-l border-lime p-5 print:hidden">
        <p className="mono text-[11px] tracking-wider text-olive-mute">家庭沟通锦囊</p>
        <h2 className="mt-1 text-[19px] font-bold leading-snug text-olive">
          不是谁改脾气，是把这个家的「换挡位置」标出来
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
          家庭教育认知报告回答「现在这段关系是什么样」，这一份回答「今晚回家第一句话说什么」。
          四本各管一段：给家长看的家长家庭综合版、给孩子看的学生家庭综合版、只讲孩子自己的个人版、
          只讲你一位家长的个人版。每本都带封面，也都能单独打印带走。
        </p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-olive-mute">
          数字口径：本页用 0—100 绝对分（四维不合计为 100）。DISC 详版用双极倾向度 ±100%，
          两者是同一份作答的两种刻度，换算关系为「绝对分 = 50 ＋ 倾向度 ÷ 2」。
        </p>
      </section>

      {/* 分段切换 */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-cream-deep p-1 print:hidden">
        {groups.map((g) => (
          <button
            key={g.key}
            onClick={() => {
              setGroupKey(g.key);
              setParentIdx(0);
            }}
            className={`grow basis-[46%] rounded-lg border px-2 py-2 text-[12.5px] font-semibold transition sm:basis-[22%] ${
              group.key === g.key
                ? "border-brand bg-white text-brand shadow-sm"
                : "border-transparent bg-transparent text-olive hover:border-border"
            }`}
          >
            {g.books[0].label}
          </button>
        ))}
      </div>

      {/* 家长个人版：两位家长各一本，二级切换 */}
      {group.key === "parent" && group.books.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 px-1 print:hidden">
          <span className="text-[12px] text-olive-mute">看谁的那本：</span>
          {group.books.map((b, i) => (
            <button
              key={b.forWhom + i}
              onClick={() => setParentIdx(i)}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                i === parentIdx ? "bg-brand text-cream" : "bg-cream-deep text-olive-soft hover:bg-butter-pale"
              }`}
            >
              {b.forWhom.split("自己看")[0] || `第 ${i + 1} 位`}
            </button>
          ))}
        </div>
      )}

      {!book.ready ? (
        <EmptyBook book={book} viewer={viewer} />
      ) : (
        <>
          <BookCover book={book} stamp={stamp} />
          {book.sections.map((s) => (
            <section key={s.no} className="paper-card p-5">
              <div className="flex items-baseline gap-2">
                <span className="mono text-[11.5px] text-brand">{s.no}</span>
                <h3 className="text-[16px] font-bold text-olive">{s.title}</h3>
              </div>
              {s.lead && <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">{s.lead}</p>}
              <div className="mt-3 space-y-3">
                {s.blocks.map((b, i) => (
                  <Block key={i} b={b} />
                ))}
              </div>
            </section>
          ))}
          <p className="px-1 text-[11.5px] leading-relaxed text-olive-mute">
            这份锦囊只解释性格节奏带来的沟通错位，不含学业诊断与心理评估。所有建议都不做效果承诺；
            涉及边界问题（动手、长期辱骂、威胁、翻手机当众念出）请拨 12355 或联系学校心理老师。
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/* 封面那三个点：与四份 PDF 同一处记号，谁拿到哪本，看颜色点就能分 */
const COVER_DOT = ["#0C7064", "#52A965", "#D96A4B"];
/* 「谁的声音最大」三条颜色，纯装饰，不承载数据含义 */
const COVER_BAR = ["#0C7064", "#C08A2E", "#D96A4B", "#8A9B8E"];

function BookCover({ book, stamp }: { book: KitBook; stamp: string }) {
  const c = book.cover;
  if (!c) return null;
  return (
    /* 打印时独占第一页（break-after-page），正文从第二页起 */
    <section className="kit-cover overflow-hidden rounded-2xl border border-border/70 bg-white px-6 py-7 print:break-after-page print:rounded-none print:border-0 sm:px-10 sm:py-10">
      <div className="flex items-center gap-1.5">
        {COVER_DOT.map((color, i) => (
          <span
            key={color}
            className="rounded-full"
            style={{ background: color, width: i === 1 ? 10 : 8, height: i === 1 ? 10 : 8 }}
          />
        ))}
      </div>

      <p className="mono mt-7 text-[10.5px] uppercase tracking-[0.22em] text-olive-mute">{c.eyebrow}</p>
      <h3 className="mt-2 text-[30px] font-black leading-tight tracking-tight text-olive sm:text-[38px]">
        {book.title}
      </h3>
      <div className="mt-3 h-[3px] w-14 rounded-full bg-brand" />

      <div className="mt-4 space-y-1">
        {c.lines.map((l) => (
          <p key={l} className="text-[14px] leading-relaxed text-olive-soft">
            {l}
          </p>
        ))}
      </div>

      <span className="mt-4 inline-block rounded-md bg-brand px-2.5 py-1 text-[11.5px] font-semibold tracking-wide text-cream">
        {c.badge}
      </span>

      {/* 中部：翻开之前第一眼要看懂的那张图 */}
      <div className="mt-9">
        <p className="text-[11.5px] tracking-wide text-olive-mute">{c.visual.lead}</p>
        <div className="mt-2.5">
          <CoverVisual v={c.visual} />
        </div>
      </div>

      {/* 底部：这份给谁、数据从哪来、怎么用 */}
      <div className="mt-9 rounded-xl bg-brand-pale/45 px-4 py-1.5">
        {(book.meta.some((m) => m.k === "这份给谁")
          ? book.meta
          : [{ k: "这份给谁", v: book.forWhom }, ...book.meta]
        ).map((m) => (
          <div key={m.k} className="flex gap-3 border-b border-border/40 py-2 text-[12px] last:border-0">
            <span className="w-[68px] shrink-0 text-olive-mute">{m.k}</span>
            <span className="flex-1 font-semibold leading-relaxed text-olive">{m.v}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-3 border-t border-border/60 pt-3">
        <p className="max-w-[76%] text-[10.5px] leading-relaxed text-olive-mute">{c.footNote}</p>
        <p className="whitespace-nowrap text-[10.5px] text-olive-mute">{stamp}</p>
      </div>
    </section>
  );
}

function CoverVisual({ v }: { v: KitCoverVisual }) {
  if (v.t === "say-cards") {
    return (
      <div>
        <div className="grid gap-2 sm:grid-cols-3">
          {v.items.map((it, i) => (
            <div key={`${it.name}-${i}`} className="rounded-xl border border-border/70 bg-cream-deep/40 px-3 py-2.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px] font-bold text-olive">{it.name}</span>
                <span className="rounded bg-white px-1 py-px text-[10.5px] font-bold text-brand">{it.type}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-olive">{it.say}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-olive-mute">想的是：{it.think}</p>
              <p className="text-[11px] leading-relaxed text-olive-mute">{it.out}</p>
            </div>
          ))}
        </div>
        <div className="mt-2.5 rounded-xl border border-border/70 bg-white px-3.5 py-2.5">
          <p className="text-[12.5px] font-semibold text-olive">{v.note.title}</p>
          {v.note.lines.map((l) => (
            <p key={l} className="mt-1 text-[11.5px] leading-relaxed text-olive-soft">
              {l}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (v.t === "voice-bars") {
    return (
      <div>
        <div className="space-y-2.5">
          {v.rows.map((r, i) => {
            const tone = COVER_BAR[i % COVER_BAR.length];
            return (
              <div key={`${r.name}-${i}`} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-[13px] font-bold text-olive">{r.name}</span>
                <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.max(5, r.value))}%`, background: tone }}
                  />
                </div>
                <span className="w-[96px] shrink-0 text-[11.5px] leading-tight" style={{ color: tone }}>
                  {r.tail}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 space-y-0.5">
          {v.lines.map((l) => (
            <p key={l} className="text-[12px] leading-relaxed text-olive-soft">
              {l}
            </p>
          ))}
          <p className="pt-1 text-[12.5px] font-bold text-brand">{v.strong}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2">
        {v.rows.map((r) => (
          <div key={r.d} className="flex items-center gap-2.5">
            <span className="w-3.5 shrink-0 text-[13px] font-bold text-olive">{r.d}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-cream-deep">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(3, r.value))}%`,
                  background: r.tag === "主导" ? "#0C7064" : r.tag === "副维" ? "#52A965" : "#CFD8CD",
                }}
              />
            </div>
            <span className="mono w-7 shrink-0 text-right text-[12px] font-semibold text-olive">{r.value}</span>
            <span className="w-8 shrink-0 text-[10.5px] text-olive-mute">{r.tag ?? ""}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-0.5">
        {v.lines.map((l) => (
          <p key={l} className="text-[12px] leading-relaxed text-olive-soft">
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}

function EmptyBook({ book, viewer }: { book: KitBook; viewer: "student" | "tutor" }) {
  /* 缺的是家长那一份，就该出家长卷的码；缺孩子那份，出学生卷的码 */
  const kind = book.key === "parent" || /家长/.test(book.missing ?? "") ? "discparent" : "disc";
  return (
    <section className="paper-card p-8 text-center">
      <p className="text-[15px] font-semibold text-olive">{book.label}还出不来</p>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-olive-mute">{book.missing}</p>
      {viewer === "tutor" ? (
        <PassStart kind={kind} />
      ) : (
        <Link
          to={`/assessments?start=${kind}`}
          className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-cream no-underline hover:bg-lime"
        >
          去做这一份
        </Link>
      )}
    </section>
  );
}

/** 伴学师端不是「我去答」，而是「把卷递出去」：出码 */
function PassStart({ kind }: { kind: string }) {
  const openPass = useAssessmentPass();
  return (
    <button
      onClick={() => openPass?.(kind)}
      className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-cream no-underline hover:bg-lime"
    >
      出码让对方填
    </button>
  );
}

/* ------------------------------------------------------------------ */

function Block({ b }: { b: KitBlock }) {
  if (b.t === "lead") {
    return <p className="text-[15px] font-semibold leading-relaxed text-olive">{b.text}</p>;
  }
  if (b.t === "p") {
    return <p className="text-[13px] leading-relaxed text-olive-soft">{b.text}</p>;
  }
  if (b.t === "quote") {
    return (
      <div className="rounded-xl border-l-2 border-brand bg-brand-pale/40 px-3.5 py-2.5">
        <p className="text-[14px] font-semibold leading-relaxed text-olive">{b.text}</p>
        {b.sub && <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-olive-soft">{b.sub}</p>}
      </div>
    );
  }
  if (b.t === "note") {
    return <p className="text-[11px] leading-relaxed text-olive-mute">{b.text}</p>;
  }
  if (b.t === "list") {
    const Tag = b.ordered ? "ol" : "ul";
    return (
      <Tag className={`${b.ordered ? "list-decimal" : "list-disc"} space-y-1.5 pl-5 text-[13px] leading-relaxed text-olive`}>
        {b.items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </Tag>
    );
  }
  if (b.t === "table") {
    const markRow = b.mark?.row;
    const markCol = b.mark ? b.mark.col + 1 : -1;
    return (
      <div>
        <div className="-mx-1 overflow-x-auto">
        {/* 两列表格手机上不必横滑；三列以上才给最小宽度，靠横向滚动保住可读性 */}
        <table className={`w-full border-collapse text-[12.5px] ${b.head.length > 2 ? "min-w-[520px]" : ""}`}>
          <thead>
            <tr>
              {b.head.map((h, i) => (
                <th
                  key={i}
                  className="border-b border-border/80 bg-cream-deep px-2.5 py-2 text-left font-semibold text-olive"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, ri) => {
              const hitRow = b.mark && b.mark.row === ri;
              return (
                <tr key={ri} className={hitRow ? "bg-brand-pale/40" : ri % 2 ? "bg-cream-deep/40" : ""}>
                  {r.map((c, ci) => {
                    const hitCell = markRow === ri && markCol === ci;
                    return (
                      <td
                        key={ci}
                        className={`whitespace-pre-line border-b border-border/50 px-2.5 py-2 align-top leading-relaxed ${
                          ci === 0 ? "text-olive" : "text-olive-soft"
                        } ${hitCell ? "bg-brand-pale font-semibold text-olive" : ""}`}
                      >
                        {c}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        {b.mark && (
          <p className="mt-1.5 px-1 text-[11.5px] leading-relaxed text-olive-mute">
            标色的那一格，就是你们这一对的位置（行＝家长主导维，列＝孩子主导维）。
          </p>
        )}
      </div>
    );
  }
  if (b.t === "cards") {
    return (
      <div className="grid gap-2.5 sm:grid-cols-2">
        {b.items.map((c, i) => (
          <div key={i} className="rounded-xl border border-border/70 bg-cream-deep/60 px-3.5 py-3">
            <div className="text-[13.5px] font-bold text-olive">{c.title}</div>
            {c.sub && <div className="mt-0.5 text-[11.5px] text-olive-mute">{c.sub}</div>}
            <div className="mt-1.5 space-y-1.5">
              {c.rows.map((r, j) => (
                <p key={j} className="text-[12.5px] leading-relaxed text-olive-soft">
                  {r.k && <span className="mr-1 font-semibold text-olive">{r.k}：</span>}
                  {r.v}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (b.t === "dim-bars") {
    const max = Math.max(...b.rows.map((r) => r.value), 100);
    return (
      <div className="space-y-2">
        {b.rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2.5">
            <span className="w-24 shrink-0 text-[12.5px] text-olive">{r.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
              <div
                className="h-full rounded-full"
                style={{ width: `${(r.value / max) * 100}%`, background: r.tag === "主导" ? "#0C7064" : r.tag === "副维" ? "#52A965" : "#C9D3C8" }}
              />
            </div>
            <span className="mono w-8 text-right text-[12px] text-olive">{r.value}</span>
            <span className="w-9 text-[11px] text-olive-mute">{r.tag ?? ""}</span>
          </div>
        ))}
      </div>
    );
  }
  if (b.t === "group-bars") {
    return (
      <div className="space-y-3">
        {b.groups.map((g) => (
          <div key={g.label}>
            <div className="flex items-baseline gap-2">
              <span className="text-[12.5px] font-semibold text-olive">{g.label}</span>
              {g.sub && <span className="text-[11px] text-olive-mute">{g.sub}</span>}
            </div>
            <div className="mt-1 space-y-1">
              {g.rows.map((r) => (
                <div key={r.name} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[11.5px] text-olive-soft">{r.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-deep">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${r.value}%` }} />
                  </div>
                  <span className="mono w-7 text-right text-[11.5px] text-olive">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
