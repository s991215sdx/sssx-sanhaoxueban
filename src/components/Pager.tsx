/**
 * v160：分页条——共 N 条 · 第 x/y 页 + 页码（≤7 页全显，超出窗口显示）+ 上一页/下一页。
 * 只有一页时不渲染。
 */
const btn =
  "rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-40 " +
  "text-olive hover:bg-butter-pale/60 border border-transparent hover:border-[#E3B53A]/50";
const btnActive = "rounded-lg px-2.5 py-1 text-[12px] font-semibold bg-lime text-white";
const btnEdge =
  "rounded-lg border border-border bg-cream-card px-3 py-1 text-[12px] font-medium text-olive transition-colors " +
  "hover:border-[#E3B53A]/50 hover:bg-butter-pale/60 disabled:opacity-40";

function pageWindow(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const nums = new Set<number>([1, 2, totalPages - 1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages));
  const sorted = [...nums].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

export default function Pager({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-2.5">
      <span className="text-[12px] text-olive-mute">
        共 {total} 条 · 第 {page} / {totalPages} 页
      </span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} className={btnEdge}>
          上一页
        </button>
        {pageWindow(page, totalPages).map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1 text-[12px] text-olive-mute">
              …
            </span>
          ) : (
            <button key={n} onClick={() => onChange(n)} className={n === page ? btnActive : btn}>
              {n}
            </button>
          ),
        )}
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className={btnEdge}>
          下一页
        </button>
      </div>
    </div>
  );
}
