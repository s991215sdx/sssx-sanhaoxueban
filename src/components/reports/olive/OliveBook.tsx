/**
 * olive book 式样共享原语：与「选科及升学规划报告」同语言的纸张书页版式。
 * 六份单项测评「新版」共用：封面 / 书页 / 章节标题 / 卡片 / 圆点列表 / 图表。
 * 屏幕 + 打印（A4 分页不变型）双适配；样式经 <style> 注入，类名 ob- 前缀避免与全局冲突。
 */
import type { CSSProperties, ReactNode } from "react";

export const OLIVE_CSS = `
.ob-root { background: #EAF3EE; padding: 8px 0 40px; border-radius: 12px; }
.ob-book { max-width: 900px; margin: 0 auto; padding: 0 12px; }
.ob-page { background: #FFFFFF; margin: 24px auto; padding: 52px 56px 72px; position: relative; box-shadow: 0 2px 14px rgba(11,61,46,.08); border-radius: 4px; max-width: 860px; min-height: 1100px; display: flex; flex-direction: column; }
.ob-pfoot { position: absolute; bottom: 22px; left: 56px; right: 56px; display: flex; justify-content: space-between; font-size: 10px; letter-spacing: 3px; color: #8FA39B; }
.ob-pdot { width: 7px; height: 7px; border-radius: 50%; background: #0EA875; display: inline-block; margin-right: 6px; }
.ob-page h1 { font-size: 30px; letter-spacing: 2px; color: #0B3D2E; font-weight: 800; line-height: 1.35; }
.ob-page h2 { font-size: 22px; color: #0B3D2E; font-weight: 800; }
.ob-part-tag { display: inline-flex; align-items: center; gap: 10px; color: #0B8A63; font-size: 13px; letter-spacing: 4px; font-weight: 600; margin-bottom: 14px; }
.ob-part-tag::before { content: ""; width: 26px; height: 2px; background: #0EA875; }
.ob-divider { height: 1px; background: #E3EEE8; margin: 24px 0; }
.ob-card { background: #F0FAF5; border: 1px solid #E3EEE8; border-radius: 12px; padding: 22px 26px; }
.ob-card.ob-white { background: #fff; }
.ob-klabel { font-size: 12px; letter-spacing: 3px; color: #8FA39B; text-transform: uppercase; }
.ob-muted { color: #4B5F57; font-size: 13px; line-height: 2; }
.ob-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.ob-sec-title { display: flex; align-items: center; gap: 12px; margin: 32px 0 16px; flex-wrap: wrap; }
.ob-sec-title .ob-n { width: 30px; height: 30px; border-radius: 50%; background: #0EA875; color: #fff; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex: none; }
.ob-sec-title h3 { font-size: 17px; color: #0B3D2E; font-weight: 800; }
.ob-sec-title .ob-sub { font-size: 12px; color: #8FA39B; margin-left: auto; }
.ob-tag { display: inline-block; padding: 3px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; }
.ob-t-hi { background: #D4F2E8; color: #0B8A63; }
.ob-ribbon { display: inline-block; background: #0EA875; color: #fff; font-size: 14px; font-weight: 700; padding: 6px 22px 6px 14px; border-radius: 0 99px 99px 0; }
ul.ob-dots { list-style: none; margin: 0; padding: 0; }
ul.ob-dots li { position: relative; padding-left: 20px; font-size: 13.5px; line-height: 2; color: #4B5F57; margin-bottom: 6px; }
ul.ob-dots li::before { content: ""; position: absolute; left: 2px; top: 12px; width: 7px; height: 7px; border-radius: 50%; background: #0EA875; }
ul.ob-dots.ob-warn li::before { background: #F0A92E; }
.ob-bigscore { display: flex; align-items: baseline; justify-content: space-between; border-radius: 10px; background: #E4F7EC; padding: 10px 18px; margin: 12px 0; }
.ob-bigscore b { font-size: 24px; color: #0B8A63; }
.ob-typehero { display: flex; align-items: center; gap: 26px; background: linear-gradient(135deg, #F0FAF5, #E4F7EC); border: 1px solid #E3EEE8; border-radius: 16px; padding: 30px 34px; }
.ob-typehero .ob-code { font-size: 56px; font-weight: 800; color: #0B8A63; letter-spacing: 4px; line-height: 1; }
.ob-typehero .ob-nm { font-size: 20px; font-weight: 700; margin-bottom: 6px; color: #0B3D2E; }
.ob-typehero .ob-hd { font-size: 14px; color: #4B5F57; line-height: 1.9; }
.ob-table { border-collapse: collapse; width: 100%; }
.ob-table th { background: #D4F2E8; color: #0B8A63; font-size: 13px; padding: 10px 8px; border: 1px solid #CDEBDD; font-weight: 700; }
.ob-table td { font-size: 13px; padding: 9px 8px; border: 1px solid #E8F1EC; text-align: center; color: #4B5F57; }
/* ---------- 移动端 ---------- */
@media (max-width: 768px) {
  .ob-root { background: #fff; padding: 0 0 24px; border-radius: 0; }
  .ob-book { padding: 0; }
  .ob-page { margin: 0 auto 14px; padding: 26px 16px 36px; max-width: 100%; min-height: 0 !important; border-radius: 0; box-shadow: none; border-bottom: 1px solid #E3EEE8; }
  .ob-pfoot { position: static; margin-top: 26px; padding-top: 10px; border-top: 1px dashed #E3EEE8; }
  .ob-page h1 { font-size: 26px; }
  .ob-page h2 { font-size: 19px; }
  .ob-card { padding: 16px 18px; }
  .ob-muted { font-size: 14px; line-height: 1.95; }
  .ob-grid2 { grid-template-columns: 1fr; }
  .ob-typehero { flex-direction: column; align-items: flex-start; gap: 14px; padding: 22px 20px; }
  .ob-typehero .ob-code { font-size: 44px; }
  .ob-sec-title { margin: 24px 0 14px; gap: 8px; }
  .ob-sec-title .ob-sub { margin-left: 0; width: 100%; }
  .ob-page svg { max-width: 100%; height: auto; }
  .ob-table th { font-size: 12px; padding: 9px 6px; }
  .ob-table td { font-size: 12.5px; padding: 9px 6px; }
  .ob-part-tag { letter-spacing: 2px; }
  .ob-klabel { letter-spacing: 2px; }
}
/* ---------- 打印 / 另存 PDF：book 式样逐页 A4，不变型 ---------- */
@media print {
  .ob-root { background: #fff; padding: 0; }
  .ob-book { max-width: none; padding: 0; }
  .ob-page { box-shadow: none; margin: 0; border-radius: 0; max-width: none; min-height: 281mm !important; height: auto; padding: 14px 22px 40px; break-after: page; page-break-after: always; }
  .ob-page:last-child { break-after: auto; page-break-after: auto; }
  .ob-pfoot { bottom: 8px; left: 22px; right: 22px; }
  .ob-card { padding: 12px 16px; }
  .ob-sec-title { margin: 14px 0 8px; }
  .ob-page h2 { font-size: 20px; }
  .ob-muted { line-height: 1.8; }
  .ob-part-tag { margin-bottom: 8px; }
  .ob-page svg { max-height: 250px; }
  ul.ob-dots li { line-height: 1.85; margin-bottom: 4px; }
}
/* ---------- 流式书页：封面 + 原版完整内容直接排入 A4 流（升学指导 / 家长认知用） ---------- */
.ob-root .ob-flow { max-width: 860px; margin: 0 auto; padding: 2px 4px 36px; }
.ob-flow > * { margin-top: 14px; }
@media print {
  .ob-root .ob-flow { max-width: none; padding: 0; }
  .ob-flow > .paper-card, .ob-flow > details, .ob-flow > .rounded-xl { break-inside: avoid; page-break-inside: avoid; box-shadow: none; }
}
`;

/** 注入 olive 样式（整个应用单例即可，重复注入无害但应避免）。 */
let injected = false;
export function OliveStyle() {
  if (!injected && typeof document !== "undefined") {
    injected = true;
    const el = document.createElement("style");
    el.setAttribute("data-olive", "1");
    el.textContent = OLIVE_CSS;
    document.head.appendChild(el);
  }
  return null;
}

const FOOT = "EVALUATION REPORT · 三好学伴";

export function OBook({ children }: { children: ReactNode }) {
  return (
    <div className="ob-root">
      <div className="ob-book">{children}</div>
    </div>
  );
}

export function OPage({ no, foot = FOOT, flex, style, children }: {
  no: number;
  foot?: string;
  /** 封面页：内容垂直居中 */
  flex?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className="ob-page" style={{ ...(flex ? { justifyContent: "flex-start" } : undefined), ...style }}>
      {children}
      <div className="ob-pfoot">
        <span>
          <i className="ob-pdot" />
          {foot}
        </span>
        <span>{String(no).padStart(2, "0")}</span>
      </div>
    </div>
  );
}

export function OCover({ klabel, title, subtitle, info, note }: {
  klabel: string;
  title: ReactNode;
  subtitle: ReactNode;
  info: [string, ReactNode][];
  note?: ReactNode;
}) {
  return (
    <OPage no={1} flex style={{ minHeight: 1100 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <span className="ob-pdot" />
        <span className="ob-pdot" />
        <span className="ob-pdot" />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start" }}>
        <div className="ob-klabel" style={{ marginBottom: 18 }}>{klabel}</div>
        <h1>{title}</h1>
        <div style={{ marginTop: 26, width: 64, height: 4, background: "#0EA875", borderRadius: 2 }} />
        <p style={{ marginTop: 26, color: "#4B5F57", fontSize: 15, lineHeight: 2.2 }}>{subtitle}</p>
      </div>
      <div className="ob-card" style={{ width: 340, maxWidth: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 22px", fontSize: 14 }}>
          {info.map(([k, v]) => (
            <span key={k} style={{ display: "contents" }}>
              <span className="ob-muted" style={{ fontSize: 13 }}>{k}</span>
              <span style={{ fontWeight: 600, color: "#0B3D2E" }}>{v}</span>
            </span>
          ))}
        </div>
        {note && <p style={{ marginTop: 14, fontSize: 12, color: "#8FA39B", lineHeight: 1.9 }}>{note}</p>}
      </div>
    </OPage>
  );
}

export function OPartTag({ children }: { children: ReactNode }) {
  return <div className="ob-part-tag">{children}</div>;
}

export function OSecTitle({ n, title, sub }: { n: number | string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="ob-sec-title">
      <span className="ob-n">{n}</span>
      <h3>{title}</h3>
      {sub && <span className="ob-sub">{sub}</span>}
    </div>
  );
}

export function OCard({ white, style, className, children }: { white?: boolean; style?: CSSProperties; className?: string; children: ReactNode }) {
  return (
    <div className={`ob-card${white ? " ob-white" : ""}${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </div>
  );
}

export function ODots({ items, warn }: { items: ReactNode[]; warn?: boolean }) {
  return (
    <ul className={`ob-dots${warn ? " ob-warn" : ""}`}>
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

export function OTag({ hi, children }: { hi?: boolean; children: ReactNode }) {
  return <span className={`ob-tag${hi ? " ob-t-hi" : ""}`}>{children}</span>;
}

export function OTypeHero({ code, name, headline, tags }: { code: ReactNode; name: ReactNode; headline?: ReactNode; tags?: string[] }) {
  return (
    <div className="ob-typehero">
      <div className="ob-code">{code}</div>
      <div>
        <div className="ob-nm">{name}</div>
        {headline && <div className="ob-hd">{headline}</div>}
        {tags && tags.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {tags.map((t) => (
              <OTag key={t} hi>
                <span style={{ marginRight: 8 }}>{t}</span>
              </OTag>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function OBigScore({ label, value, color }: { label: ReactNode; value: ReactNode; color?: string }) {
  return (
    <div className="ob-bigscore">
      <span style={{ fontWeight: 700, color: "#0B3D2E" }}>{label}</span>
      <b style={color ? { color } : undefined}>{value}</b>
    </div>
  );
}

/* ================= 图表（算法与已定稿样张一致） ================= */

export type OPair = { a: string; aName?: string; av: number; b: string; bName?: string; bv: number; max: number };

/** 双向对比条（MBTI 四维度） */
export function OPairBars({ pairs, width = 780, height = 240 }: { pairs: OPair[]; width?: number; height?: number }) {
  const pad = 8;
  const rowH = (height - pad * 2) / pairs.length;
  const barH = 18;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", maxWidth: "100%" }}>
      {pairs.map((p, i) => {
        const y = pad + i * rowH + rowH / 2;
        const half = (width - 140) / 2;
        const midX = width / 2;
        const aw = (half * p.av) / p.max;
        const bw = (half * p.bv) / p.max;
        const winA = p.av >= p.bv;
        const winB = p.bv >= p.av;
        return (
          <g key={i}>
            <text x={70} y={y - 14} textAnchor="middle" fontSize={13} fontWeight={700} fill={winA ? "#0B8A63" : "#8FA39B"}>
              {p.a} {p.av}
            </text>
            <text x={width - 70} y={y - 14} textAnchor="middle" fontSize={13} fontWeight={700} fill={winB ? "#0B8A63" : "#8FA39B"}>
              {p.b} {p.bv}
            </text>
            <rect x={midX - aw - 8} y={y - barH / 2} width={aw} height={barH} rx={9} fill={winA ? "#0EA875" : "#C9E0CE"} />
            <rect x={midX + 8} y={y - barH / 2} width={bw} height={barH} rx={9} fill={winB ? "#0EA875" : "#C9E0CE"} />
            <text x={midX} y={y + 5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#8FA39B">
              VS
            </text>
            {p.aName && (
              <text x={70} y={y + 24} textAnchor="middle" fontSize={11} fill="#8FA39B">
                {p.aName}
              </text>
            )}
            {p.bName && (
              <text x={width - 70} y={y + 24} textAnchor="middle" fontSize={11} fill="#8FA39B">
                {p.bName}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export type OHRow = { label: string; value: number; max: number; color?: string; vtext?: string };

const levelColor = (v: number) => (v < 3.0 ? "#E4572E" : v < 3.8 ? "#F0A92E" : "#3CC078");

/** 水平条 */
export function OHBars({ rows, width = 780, height }: { rows: OHRow[]; width?: number; height?: number }) {
  const pad = 6;
  const H = height ?? rows.length * 52 + pad * 2;
  const rowH = (H - pad * 2) / rows.length;
  const labelW = 118;
  const valW = 46;
  const barMax = width - labelW - valW - 30;
  return (
    <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} style={{ display: "block", maxWidth: "100%" }}>
      {rows.map((r, i) => {
        const y = pad + i * rowH + rowH / 2;
        const color = r.color ?? (r.max <= 5 ? levelColor(r.value) : "#0EA875");
        return (
          <g key={i}>
            <text x={labelW - 10} y={y + 5} textAnchor="end" fontSize={13} fill="#4B5F57">
              {r.label}
            </text>
            <rect x={labelW} y={y - 8} width={barMax} height={16} rx={8} fill="#EDF3EF" />
            <rect x={labelW} y={y - 8} width={Math.max(8, barMax * Math.min(1, r.value / r.max))} height={16} rx={8} fill={color} />
            <text x={labelW + barMax + 16} y={y + 5} fontSize={13} fontWeight={700} fill={color}>
              {r.vtext ?? String(r.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 六维雷达图 */
export function ORadar({ axes, values, max, width = 400, height = 360 }: { axes: string[]; values: number[]; max: number; width?: number; height?: number }) {
  const cx = width / 2;
  const cy = height / 2 + 4;
  const R = Math.min(width, height) / 2 - 46;
  const n = axes.length;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const rings = [1, 2, 3, 4].map((ring) => {
    const rr = (R * ring) / 4;
    let d = "";
    for (let i = 0; i <= n; i++) {
      const [x, y] = pt(i % n, rr);
      d += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d + "Z";
  });
  let dataD = "";
  for (let j = 0; j <= n; j++) {
    const v = values[j % n] / max;
    const [x, y] = pt(j % n, R * Math.max(0.08, v));
    dataD += `${j ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", maxWidth: "100%" }}>
      {rings.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#E3EEE8" strokeWidth={1} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E3EEE8" strokeWidth={1} />;
      })}
      <path d={dataD + "Z"} fill="rgba(14,168,117,.20)" stroke="#0EA875" strokeWidth={2} />
      {axes.map((label, k) => {
        const v = values[k] / max;
        const [px, py] = pt(k, R * Math.max(0.08, v));
        const [lx, ly] = pt(k, R + 22);
        return (
          <g key={label}>
            <circle cx={px} cy={py} r={4} fill="#0B8A63" />
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize={13} fontWeight={values[k] >= 4 ? 700 : 400} fill={values[k] >= 4 ? "#0B8A63" : "#4B5F57"}>
              {label}
            </text>
            <text x={px} y={py - 9} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0B8A63">
              {values[k]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
