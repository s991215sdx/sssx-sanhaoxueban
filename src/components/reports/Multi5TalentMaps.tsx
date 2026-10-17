import type { Multi5Result } from "@contracts/multi5";
import { MULTI5_DIM_LABEL, MULTI5_DIM_ORDER } from "@contracts/multi5";
import { MULTI5_TALENT_MAP } from "@contracts/multi5Map";

/**
 * v181 多元智能五项 → 学科 / 职业 / 提升项目参考图（多元报告、学习力综合报告、三好生涯报告共用）：
 * 左侧五维圆环图（外圈维度名 → 中环得分进度 → 内环得分占比，中心为综合水平），
 * 右侧三张卡分别汇总优势学科、优势职业、可培训提升项目。
 * 优势口径：≥80 分为优势维度；若五项均不足 80 分，则取得分最高的两项作为相对优势。
 */
const bandColor = (v: number) => (v >= 80 ? "#0EA875" : v >= 60 ? "#F0A92E" : "#E4572E");

function polar(cx: number, cy: number, a: number, r: number): readonly [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}
/** 圆环扇区（r1 外径，r2 内径，a0→a1 逆时针？SVG y 向下，用大弧标志按角度差） */
function ringSeg(cx: number, cy: number, r1: number, r2: number, a0: number, a1: number): string {
  const [x1, y1] = polar(cx, cy, a0, r1);
  const [x2, y2] = polar(cx, cy, a1, r1);
  const [x3, y3] = polar(cx, cy, a1, r2);
  const [x4, y4] = polar(cx, cy, a0, r2);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r1},${r1} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${x3.toFixed(2)},${y3.toFixed(2)} A${r2},${r2} 0 ${large} 0 ${x4.toFixed(2)},${y4.toFixed(2)} Z`;
}
/** 扇形（圆心出发，半径 r） */
function pieSeg(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x1, y1] = polar(cx, cy, a0, r);
  const [x2, y2] = polar(cx, cy, a1, r);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
}

const CX = 170;
const CY = 170;
const GAP = 0.055; // 段间留白（弧度）

function TalentDonut({ multi5 }: { multi5: Multi5Result }) {
  const span = (2 * Math.PI) / 5;
  const segs = MULTI5_DIM_ORDER.map((k, i) => {
    const a0 = -Math.PI / 2 + i * span + GAP / 2;
    return { k, v: multi5.dims[k], a0, a1: a0 + span - GAP, mid: a0 + (span - GAP) / 2 };
  });
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 340 340" style={{ width: "100%", maxWidth: 320, height: "auto", display: "block" }}>
        {/* 外圈：维度名色带 */}
        {segs.map((s) => (
          <path key={`o-${s.k}`} d={ringSeg(CX, CY, 130, 116, s.a0, s.a1)} fill={bandColor(s.v)} opacity={0.92} />
        ))}
        {/* 外圈标签（外置 + 引导点，不再被裁切） */}
        {segs.map((s) => {
          const deg = ((s.mid * 180) / Math.PI + 360) % 360;
          const anchor = deg > 60 && deg < 120 ? "middle" : deg <= 60 || deg >= 300 ? "start" : "end";
          const [px, py] = polar(CX, CY, s.mid, 138);
          const [tx, ty] = polar(CX, CY, s.mid, 152);
          return (
            <g key={`l-${s.k}`}>
              <circle cx={px} cy={py} r={2.2} fill={bandColor(s.v)} />
              <text x={tx} y={ty + 4} textAnchor={anchor} fontSize={12} fontWeight={600} fill="#4B5F57">
                {MULTI5_DIM_LABEL[s.k]}
              </text>
            </g>
          );
        })}
        {/* 中环：灰色轨道 + 得分进度 */}
        {segs.map((s) => (
          <g key={`m-${s.k}`}>
            <path d={ringSeg(CX, CY, 104, 92, s.a0, s.a1)} fill="#EDF3EF" />
            <path d={ringSeg(CX, CY, 104, 92, s.a0, s.a0 + (s.a1 - s.a0) * Math.min(1, s.v / 100))} fill={bandColor(s.v)} opacity={0.85} />
          </g>
        ))}
        {/* 内环：得分占比扇形（半径随分值） */}
        {segs.map((s) => {
          const r = 26 + (s.v / 100) * 58;
          const [lx, ly] = polar(CX, CY, s.mid, Math.max(r - 14, 30));
          const inside = r - 14 >= 30;
          const [ox, oy] = polar(CX, CY, s.mid, r + 13);
          return (
            <g key={`i-${s.k}`}>
              <path d={pieSeg(CX, CY, r, s.a0, s.a1)} fill={bandColor(s.v)} opacity={0.9} />
              {inside ? (
                <text x={lx} y={ly + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
                  {s.v}%
                </text>
              ) : (
                <text x={ox} y={oy + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={bandColor(s.v)}>
                  {s.v}%
                </text>
              )}
            </g>
          );
        })}
        {/* 中心：综合水平 */}
        <circle cx={CX} cy={CY} r={24} fill="#fff" stroke="#E3EEE8" />
        <text x={CX} y={CY - 3} textAnchor="middle" fontSize={9.5} fill="#8FA39B">综合水平</text>
        <text x={CX} y={CY + 13} textAnchor="middle" fontSize={16} fontWeight={800} fill="#0B3D2E">
          {multi5.overall}%
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10.5px] text-olive-mute">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#0EA875" }} />≥80 优势</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#F0A92E" }} />60—79 良好</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#E4572E" }} />&lt;60 待提升</span>
      </div>
    </div>
  );
}

export default function Multi5TalentMaps({ multi5 }: { multi5: Multi5Result }) {
  const byScore = [...MULTI5_DIM_ORDER].sort((a, b) => multi5.dims[b] - multi5.dims[a]);
  /* 优势口径：≥80 为优势；若全部 <80，则取相对优势前二 */
  const strengthKeys = (() => {
    const hi = byScore.filter((k) => multi5.dims[k] >= 80);
    return hi.length > 0 ? hi : byScore.slice(0, 2);
  })();
  const fallbackNote = strengthKeys.length === 2 && !strengthKeys.some((k) => multi5.dims[k] >= 80);

  const card = (title: string, pick: (k: (typeof byScore)[number]) => string[], accent: string, keys: (typeof byScore), note?: string) => (
    <div className="rounded-2xl border border-border bg-cream p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="h-3.5 w-1.5 rounded-full" style={{ background: accent }} />
        <b className="text-[13.5px] text-olive">{title}</b>
        {note && <span className="text-[10.5px] text-olive-mute">{note}</span>}
      </div>
      <div className="mt-2.5 space-y-2">
        {keys.map((k) => (
          <div key={k} className="flex items-baseline gap-2">
            <span className={`w-14 shrink-0 text-[11.5px] font-bold ${multi5.dims[k] >= 80 ? "text-brand-deep" : "text-olive-soft"}`}>
              {MULTI5_DIM_LABEL[k]}
              <b className="ml-0.5">{multi5.dims[k]}</b>
            </span>
            <span className="text-[11.5px] leading-relaxed text-olive-soft">{pick(k).join("、")}</span>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div>
      <div className="grid items-center gap-4 md:grid-cols-[260px_1fr]">
        <TalentDonut multi5={multi5} />
        <div className="space-y-3">
          {card("优势学科汇总", (k) => MULTI5_TALENT_MAP[k].subjects, "#0EA875", strengthKeys, fallbackNote ? "本次未出现 ≥80 分维度，按相对优势取前两项" : undefined)}
          {card("优势职业汇总", (k) => MULTI5_TALENT_MAP[k].careers, "#3E7CB1", strengthKeys, fallbackNote ? "本次未出现 ≥80 分维度，按相对优势取前两项" : undefined)}
          {card("可培训提升项目", (k) => MULTI5_TALENT_MAP[k].trainings, "#F0A92E", byScore)}
        </div>
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-olive-mute">
        以上为五维智能与学科、职业、培训项目的对应参考：智能得分越高的维度，其对应学科往往学得更省力、对应职业方向更匹配；待提升维度对应的培训项目可作为扬长补短的选择。请结合兴趣与学业综合考量。
      </p>
    </div>
  );
}
