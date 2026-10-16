import type { Multi5Result } from "@contracts/multi5";
import { MULTI5_DIM_LABEL, MULTI5_DIM_ORDER } from "@contracts/multi5";
import { MULTI5_TALENT_MAP } from "@contracts/multi5Map";

/**
 * v178 多元智能五项 → 学科 / 职业 / 提升项目参考图（多元报告、学习力综合报告、三好生涯报告共用）：
 * 左侧五维环形图（中心为综合水平），右侧三张卡分别汇总优势学科、优势职业、可培训提升项目。
 */
const wedgeColor = (v: number) => (v >= 80 ? "#0EA875" : v >= 60 ? "#F0A92E" : "#E4572E");

function TalentDonut({ multi5 }: { multi5: Multi5Result }) {
  const cx = 110, cy = 110, R = 96, r = 52;
  let a0 = -Math.PI / 2;
  const segs = MULTI5_DIM_ORDER.map((k) => {
    const a1 = a0 + (2 * Math.PI) / 5 - 0.035;
    const seg = { k, v: multi5.dims[k], a0, a1 };
    a0 += (2 * Math.PI) / 5;
    return seg;
  });
  const pt = (a: number, rr: number) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="220" viewBox="0 0 220 220">
        {segs.map((s) => {
          const [x1, y1] = pt(s.a0, R), [x2, y2] = pt(s.a1, R), [x3, y3] = pt(s.a1, r), [x4, y4] = pt(s.a0, r);
          const mid = (s.a0 + s.a1) / 2;
          const [lx, ly] = pt(mid, (R + r) / 2);
          const [tx, ty] = pt(mid, R + 15);
          return (
            <g key={s.k}>
              <path d={`M${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 0 0 ${x4},${y4} Z`} fill={wedgeColor(s.v)} opacity={0.9} />
              <text x={lx} y={ly + 4} textAnchor="middle" fontSize="13" fontWeight={700} fill="#fff">{s.v}</text>
              <text x={tx} y={ty + 4} textAnchor="middle" fontSize="10.5" fill="#4B5F57">
                {MULTI5_DIM_LABEL[s.k]}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={r - 6} fill="#fff" stroke="#E3EEE8" />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10" fill="#8FA39B">综合水平</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="22" fontWeight={800} fill="#0B3D2E">{multi5.overall}</text>
      </svg>
      <div className="mt-1 flex items-center gap-3 text-[10.5px] text-olive-mute">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#0EA875" }} />≥80 优势</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#F0A92E" }} />60—79 良好</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#E4572E" }} />&lt;60 待提升</span>
      </div>
    </div>
  );
}

export default function Multi5TalentMaps({ multi5 }: { multi5: Multi5Result }) {
  const byScore = [...MULTI5_DIM_ORDER].sort((a, b) => multi5.dims[b] - multi5.dims[a]);
  const card = (title: string, pick: (k: (typeof byScore)[number]) => string[], accent: string) => (
    <div className="rounded-2xl border border-border bg-cream p-4">
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-1.5 rounded-full" style={{ background: accent }} />
        <b className="text-[13.5px] text-olive">{title}</b>
      </div>
      <div className="mt-2.5 space-y-2">
        {byScore.map((k) => (
          <div key={k} className="flex items-baseline gap-2">
            <span className={`w-14 shrink-0 text-[11.5px] font-bold ${multi5.dims[k] >= 80 ? "text-brand-deep" : "text-olive-soft"}`}>
              {MULTI5_DIM_LABEL[k]}
            </span>
            <span className="text-[11.5px] leading-relaxed text-olive-soft">{pick(k).join("、")}</span>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div>
      <div className="grid items-center gap-4 md:grid-cols-[230px_1fr]">
        <TalentDonut multi5={multi5} />
        <div className="space-y-3">
          {card("优势学科汇总", (k) => MULTI5_TALENT_MAP[k].subjects, "#0EA875")}
          {card("优势职业汇总", (k) => MULTI5_TALENT_MAP[k].careers, "#3E7CB1")}
          {card("可培训提升项目", (k) => MULTI5_TALENT_MAP[k].trainings, "#F0A92E")}
        </div>
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-olive-mute">
        以上为五维智能与学科、职业、培训项目的对应参考：智能得分越高的维度，其对应学科往往学得更省力、对应职业方向更匹配；待提升维度对应的培训项目可作为扬长补短的选择。请结合兴趣与学业综合考量。
      </p>
    </div>
  );
}
