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
import { buildCommKit, type KitBlock, type KitBook } from "@contracts/familyCommKit";
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

  const [groupKey, setGroupKey] = useState<string>("trio");
  const [parentIdx, setParentIdx] = useState(0);

  const group = groups.find((g) => g.key === groupKey) ?? groups[0];
  const book = group.books[Math.min(parentIdx, group.books.length - 1)] ?? group.books[0];

  return (
    <div className="space-y-4">
      {/* 口径声明：这一份与 DISC 详版的数字关系，先说清楚，避免两处看起来打架 */}
      <section className="paper-card accent-l border-lime p-5">
        <p className="mono text-[11px] tracking-wider text-olive-mute">家庭沟通锦囊</p>
        <h2 className="mt-1 text-[19px] font-bold leading-snug text-olive">
          不是谁改脾气，是把这个家的「换挡位置」标出来
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
          家庭教育认知报告回答「现在这段关系是什么样」，这一份回答「今晚回家第一句话说什么」。
          四本各管一段：全家一起看的三人版、给孩子看的学生版、只讲孩子自己的个人版、只讲你一位家长的个人版。
        </p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-olive-mute">
          数字口径：本页用 0—100 绝对分（四维不合计为 100）。DISC 详版用双极倾向度 ±100%，
          两者是同一份作答的两种刻度，换算关系为「绝对分 = 50 ＋ 倾向度 ÷ 2」。
        </p>
      </section>

      {/* 分段切换 */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-cream-deep p-1">
        {groups.map((g) => (
          <button
            key={g.key}
            onClick={() => {
              setGroupKey(g.key);
              setParentIdx(0);
            }}
            className={`grow basis-[22%] rounded-lg border px-2 py-2 text-[12.5px] font-semibold transition ${
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
        <div className="flex flex-wrap items-center gap-2 px-1">
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
          <BookCover book={book} />
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

function BookCover({ book }: { book: KitBook }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-cream-deep p-5">
      <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-olive-mute">{book.label}</p>
      <h3 className="mt-1.5 text-[22px] font-bold leading-tight text-olive">{book.title}</h3>
      <p className="mt-1 text-[13.5px] text-olive-soft">{book.subtitle}</p>
      <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-[12.5px] leading-relaxed text-olive">
        {book.forWhom}
      </p>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
        {book.meta.map((m) => (
          <div key={m.k} className="rounded-xl bg-white/60 px-3 py-2">
            <div className="text-[11px] text-olive-mute">{m.k}</div>
            <div className="mt-0.5 text-[12px] leading-relaxed text-olive">{m.v}</div>
          </div>
        ))}
      </div>
    </section>
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
