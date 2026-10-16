import { HOLLAND_LABEL, HOLLAND_ORDER } from "@contracts/holland";
import { HOLLAND_FIELD_MAP } from "@contracts/riasecMap";

/**
 * v178 霍兰德六型学科地图（六边形蜂窝布局，升学/生涯/霍兰德报告共用）：
 * 每个类型一张卡——学科群、对应的学科专业大类、核心能力；
 * 学生的 Top 类型高亮为「优势方向」。无得分数据时全部平显（占位态）。
 */
export default function HollandHexMap({
  dims,
  top3,
}: {
  /** RIASEC 各型得分（1-5），可空。 */
  dims?: Record<string, number> | null;
  /** 学生的优势类型代码（如 ["I","A","S"]），可空。 */
  top3?: string[] | null;
}) {
  const hot = new Set(top3 ?? []);
  const score = (k: string) => {
    const v = dims?.[k];
    return typeof v === "number" ? v : null;
  };
  /* 蜂窝排布：R/I 上排，C/中/A 中排，E/S 下排 */
  const layout: (string | null)[][] = [
    ["R", "I"],
    ["C", null, "A"],
    ["E", "S"],
  ];
  const cell = (k: string) => {
    const info = HOLLAND_FIELD_MAP[k]!;
    const sc = score(k);
    const isHot = hot.has(k);
    return (
      <div
        key={k}
        className={`relative rounded-2xl border p-4 transition-colors ${
          isHot ? "border-brand bg-mint-pale/50 shadow-[0_2px_10px_-4px_rgba(14,168,117,.4)]" : "border-border bg-cream"
        }`}
      >
        {isHot && (
          <span className="absolute -top-2.5 right-3 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
            优势方向
          </span>
        )}
        <div className="flex items-center gap-2">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl text-[15px] font-bold ${
              isHot ? "bg-brand text-white" : "bg-brand-pale text-brand-deep"
            }`}
          >
            {info.track}
          </span>
          <div>
            <div className="text-[13.5px] font-bold leading-tight text-olive">
              {k} · {HOLLAND_LABEL[k as keyof typeof HOLLAND_LABEL] ?? ""}
            </div>
            <div className="text-[11px] text-olive-mute">
              {info.trackName}
              {sc != null && <b className="ml-1.5 text-brand-deep">{sc} 分</b>}
            </div>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {info.fields.map((f) => (
            <span key={f} className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${isHot ? "bg-white text-brand-deep" : "bg-white text-olive-soft"}`}>
              {f}
            </span>
          ))}
        </div>
        <div className="mt-2 text-[11px] leading-relaxed text-olive-mute">核心能力：{info.abilities.join(" · ")}</div>
      </div>
    );
  };
  return (
    <div>
      <div className="space-y-3">
        {layout.map((row, i) => (
          <div key={i} className="grid grid-cols-2 gap-3">
            {row.map((k, j) =>
              k ? (
                cell(k)
              ) : (
                <div key={`center-${j}`} className="flex flex-col items-center justify-center rounded-2xl bg-brand px-2 py-3 text-center text-white">
                  <div className="text-[11px] tracking-widest text-white/70">RIASEC</div>
                  <div className="text-[15px] font-bold leading-snug">六型<br />学科地图</div>
                </div>
              ),
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-olive-mute">
        六型对应大学科群：工(R)医药农林工程信息 · 理(I)数理化生环建 · 文(A)传播文史艺 · 人(S)教育社心 · 商(E)管理法政财经 · 事(C)财经行政数据。
        {top3?.length ? `你的优势类型为 ${HOLLAND_ORDER.filter((k) => hot.has(k)).join(" / ")}，可优先关注对应学科群。` : "完成霍兰德测评后，你的优势方向会在此高亮。"}
      </p>
    </div>
  );
}
