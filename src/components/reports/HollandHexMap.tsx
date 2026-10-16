import { HOLLAND_LABEL, HOLLAND_ORDER, hollandTopWithTies } from "@contracts/holland";
import { HOLLAND_FIELD_MAP } from "@contracts/riasecMap";

/**
 * v180 霍兰德六型学科地图（升学/生涯/霍兰德报告共用）：
 * 两排陈列：常规型·现实型·研究型 / 艺术型·社会型·企业型（霍兰德六边形相邻序）；
 * 得分统一百分制（与雷达图一致），分值最高的前三型（含并列）高亮为「优势方向」。
 * 无得分数据时全部平显（占位态）。
 */
export default function HollandHexMap({
  dims,
  top3,
}: {
  /** RIASEC 各型得分（1-5），可空。 */
  dims?: Record<string, number> | null;
  /** 学生的优势类型代码（如 ["I","A","S"]），可空；有 dims 时以「前三含并列」现算为准。 */
  top3?: string[] | null;
}) {
  /* v180：有得分时按「前三含并列」现算高亮（与雷达图同一标准），并列一并突出 */
  const computed = dims ? hollandTopWithTies(dims, 3) : [];
  const hot = new Set(computed.length ? computed : (top3 ?? []));
  const score = (k: string) => {
    const v = dims?.[k];
    return typeof v === "number" ? v : null;
  };
  /* 两排：常规型·现实型·研究型 / 艺术型·社会型·企业型 */
  const layout: string[][] = [
    ["C", "R", "I"],
    ["A", "S", "E"],
  ];
  const cell = (k: string) => {
    const info = HOLLAND_FIELD_MAP[k]!;
    const sc = score(k);
    const isHot = hot.has(k);
    return (
      <div
        key={k}
        className={`relative flex h-full flex-col rounded-2xl border p-3.5 ${
          isHot ? "border-brand/60 bg-mint-pale/60" : "border-border bg-white"
        }`}
      >
        {isHot && (
          <span className="absolute -top-2 right-2.5 rounded-full bg-brand px-2 py-px text-[10px] font-bold text-white shadow-sm">
            优势方向
          </span>
        )}
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[16px] font-bold ${
              isHot ? "bg-brand text-white" : "bg-brand-pale text-brand-deep"
            }`}
          >
            {k}
          </span>
          <div className="min-w-0 flex-1">
            <div className={`text-[13.5px] font-bold leading-tight ${isHot ? "text-brand-deep" : "text-olive"}`}>
              {HOLLAND_LABEL[k as keyof typeof HOLLAND_LABEL] ?? ""}
            </div>
            <div className="mt-0.5 text-[11px] text-olive-mute">
              {info.trackName}
              {sc != null && <b className="ml-1 text-brand-deep">{Math.round(sc * 20)} 分</b>}
            </div>
          </div>
        </div>
        {sc != null && (
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-cream-deep">
            <div className={`h-full rounded-full ${isHot ? "bg-brand" : "bg-brand/40"}`} style={{ width: `${(sc / 5) * 100}%` }} />
          </div>
        )}
        <div className="mt-2.5 flex flex-wrap gap-1">
          {info.fields.map((f) => (
            <span
              key={f}
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                isHot ? "bg-white text-brand-deep" : "bg-cream text-olive-soft"
              }`}
            >
              {f}
            </span>
          ))}
        </div>
        <div className="mt-2 border-t border-border/60 pt-2 text-[11px] leading-relaxed text-olive-mute">
          <b className="font-semibold text-olive-soft">核心能力</b>　{info.abilities.join(" · ")}
        </div>
      </div>
    );
  };
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {layout[0]!.map(cell)}
        {layout[1]!.map(cell)}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-olive-mute">
        六型对应大学科群：工(R)医药农林工程信息 · 理(I)数理化生环建 · 文(A)传播文史艺 · 人(S)教育社心 · 商(E)管理法政财经 · 事(C)财经行政数据。
        {top3?.length ? (
          <>
            <b className="text-olive">你的优势类型为 {HOLLAND_ORDER.filter((k) => hot.has(k)).join(" / ")}</b>
            ，可优先关注对应学科群——兴趣得分高的方向，通常意味着你在对应学科的学习动力与潜在表现都更好。
          </>
        ) : (
          "完成霍兰德测评后，你的优势方向会在此高亮。"
        )}
      </p>
    </div>
  );
}
