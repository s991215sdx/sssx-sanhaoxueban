/**
 * DISC 四因子倾向度图（「行为之镜」）：四色竖轴 D/I/S/C + 分值落点连线 + 反弹区灰带
 * + 动物象徽 + 特征词阵。学生版/家长版详版与升学报告 4.1 共用。
 * 从 ReportView.tsx 抽离（v77.1），避免 GuidanceTab ↔ ReportView 循环依赖。
 */
import { getDiscCombo, DISC_REPORTS } from "@/data/reports";
import { DISC_REBOUND_PCT, DISC_ANIMAL_BADGE, DISC_ANIMAL_FULL, discTendencyFromDims, discTendencyText } from "@contracts/assessments";

/** DISC 全量特征词表（对标专业词选式报告的 4×24 词阵）。 */
const DISC_WORD_GRID: Record<"D" | "I" | "S" | "C", string[]> = {
  D: ["自我中心", "强硬独断", "直截了当", "勇敢果断", "敢于冒险", "严格要求", "争先恐后", "身先士卒", "自信满满", "勇于挑战", "敏捷迅速", "独立自主", "精于计算", "深思熟虑", "理性客观", "谦恭有礼", "内向保守", "安静平和", "自制被动", "缺乏信心", "拘谨内敛", "易受控制", "谨小慎微", "自我怀疑"],
  I: ["感情用事", "冲动盲目", "情感流露", "热情奔放", "深具影响", "自我激励", "乐观开朗", "善于社交", "轻易信赖", "自信自然", "优雅大方", "和蔼可亲", "泰然自若", "若即若离", "不善言辞", "独处一隅", "不苟言笑", "实事求是", "亦步亦趋", "胆小腼腆", "手足无措", "自我防卫", "怀疑悲观", "抑郁孤僻"],
  S: ["被动消极", "一成不变", "忠诚可靠", "有始有终", "安于现状", "前后一致", "乐于跟随", "合作无间", "含蓄稳重", "稳健安定", "平静安详", "自得其乐", "友善可亲", "自然惬意", "外向活跃", "心思活络", "乐观其成", "创新求变", "警觉警惕", "坐立不安", "行为易变", "积极主动", "急躁不安", "鲁莽冲动"],
  C: ["吹毛求疵", "逃避推诿", "追求完美", "固守成规", "细致完备", "系统逻辑", "内敛敏感", "有条不紊", "善于分析", "较高标准", "关注细节", "流程导向", "独立自主", "不拘细节", "自有主张", "随心所欲", "坚持己见", "粗枝大叶", "敢于挑战", "不讲策略", "自以为是", "毫无章法", "公然违抗", "顽固不化"],
};
export const DISC_COLOR: Record<"D" | "I" | "S" | "C", string> = {
  D: "#d44f3a",
  I: "#e8a33d",
  S: "#4e9e5f",
  C: "#3d8ec4",
};
/** 因子进入高反弹区（倾向度 ≥ +80%）时的「物极必反」提示。 */
const DISC_REBOUND_HIGH: Record<"D" | "I" | "S" | "C", string> = {
  D: "果敢可能反成专断",
  I: "热情可能反成浮躁",
  S: "沉稳可能反成僵化",
  C: "严谨可能反成挑剔",
};
/** 因子进入低反弹区（倾向度 ≤ -80%）时的提示：对立面行为走到极端，同样可能反噬。 */
const DISC_REBOUND_LOW: Record<"D" | "I" | "S" | "C", string> = {
  D: "过度配合到失去主见，积压后可能突然激烈顶撞",
  I: "过度内向到自我封闭，可能以情绪爆发的方式反弹",
  S: "持续急迫到焦躁难安，可能反而把事情做乱",
  C: "过度灵活到散漫无章，关键时刻可能掉链子",
};

export default function DiscTendencyChart({
  dims,
  version,
  title,
  note,
  who,
}: {
  dims: Record<"D" | "I" | "S" | "C", number>;
  version?: 2;
  title?: string;
  note?: string;
  /** 词阵白话解读里的称呼：学生版默认「你」，家长版传家长称呼（如「妈妈」）。 */
  who?: string;
}) {
  const keys: ("D" | "I" | "S" | "C")[] = ["D", "I", "S", "C"];
  const combo = getDiscCombo(dims);
  const tendency = discTendencyFromDims(dims, version);
  const W = 460;
  const H = 268;
  const PAD_X = 56;
  const TOP = 44;
  const BOTTOM = 40;
  const plotH = H - TOP - BOTTOM;
  const xs = keys.map((_, i) => PAD_X + (i * (W - PAD_X * 2)) / 3);
  /** t ∈ [-100, +100] → y 坐标（+100 在顶）。 */
  const yOf = (t: number) => TOP + (plotH * (100 - t)) / 200;
  const highY = yOf(DISC_REBOUND_PCT);
  const lowY = yOf(-DISC_REBOUND_PCT);
  const reboundHighDims = keys.filter((k) => tendency[k] >= DISC_REBOUND_PCT);
  const reboundLowDims = keys.filter((k) => tendency[k] <= -DISC_REBOUND_PCT);
  const primaryReport = DISC_REPORTS[combo[0]];
  const plainWho = who ?? "你";
  const PLOT_L = PAD_X - 34;
  const PLOT_R = W - PAD_X + 34;
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">{title ?? "行为之镜 · DISC 四因子倾向度"}</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">
        {note ??
          `得分口径（国际通行净分倾向度）：该因子被「最像我」选中的次数 −「最不像我」选中的次数，÷24 换算为 -100%…+100% 倾向度，四因子合计恒为 0；与上方行为特征轴为同一份分数（原始倾向度，未做常模转换${version === 2 ? "" : "；旧版 12 题二选一作答换算"}）。中线 0% 为中性；顶部与底部灰色区域都是「反弹区」——倾向走入极端时物极必反。`}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="DISC 四因子双极倾向度图">
        {/* 高反弹区灰带（+80%…+100%） */}
        <rect x={PLOT_L} y={TOP} width={PLOT_R - PLOT_L} height={Math.max(0, highY - TOP)} rx={6} fill="#6b7280" opacity={0.15} />
        <text x={PLOT_R - 4} y={TOP + 12} fontSize={10} fill="#6b7280" textAnchor="end">
          高反弹区 ≥+{DISC_REBOUND_PCT}%
        </text>
        <line x1={PLOT_L} y1={highY} x2={PLOT_R} y2={highY} stroke="#6b7280" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
        {/* 低反弹区灰带（-80%…-100%） */}
        <rect x={PLOT_L} y={lowY} width={PLOT_R - PLOT_L} height={Math.max(0, TOP + plotH - lowY)} rx={6} fill="#6b7280" opacity={0.15} />
        <text x={PLOT_R - 4} y={TOP + plotH - 5} fontSize={10} fill="#6b7280" textAnchor="end">
          低反弹区 ≤-{DISC_REBOUND_PCT}%
        </text>
        <line x1={PLOT_L} y1={lowY} x2={PLOT_R} y2={lowY} stroke="#6b7280" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
        {/* 分段刻度线（每 25%，中线 0% 加粗带箭头） */}
        {[-75, -50, -25, 25, 50, 75].map((t) => (
          <line key={`seg-${t}`} x1={PLOT_L} y1={yOf(t)} x2={PLOT_R} y2={yOf(t)} stroke="#a8b08c" strokeWidth={Math.abs(t) === 50 ? 0.9 : 0.6} strokeDasharray={Math.abs(t) === 50 ? "none" : "2 4"} opacity={0.45} />
        ))}
        <line x1={PLOT_L} y1={yOf(0)} x2={PLOT_R} y2={yOf(0)} stroke="#8a9464" strokeWidth={1.6} opacity={0.85} />
        <polygon points={`${PLOT_L - 6},${yOf(0)} ${PLOT_L},${yOf(0) - 4} ${PLOT_L},${yOf(0) + 4}`} fill="#8a9464" opacity={0.85} />
        <polygon points={`${PLOT_R + 6},${yOf(0)} ${PLOT_R},${yOf(0) - 4} ${PLOT_R},${yOf(0) + 4}`} fill="#8a9464" opacity={0.85} />
        {/* 左侧刻度标签 */}
        {[100, 50, 0, -50, -100].map((t) => (
          <text key={`tick-${t}`} x={PLOT_L - 8} y={yOf(t) + 3.5} fontSize={9.5} fill="#8a9464" textAnchor="end">
            {t > 0 ? `+${t}` : t}%
          </text>
        ))}
        {/* 竖线 */}
        {keys.map((k, i) => (
          <line key={`line-${k}`} x1={xs[i]} y1={TOP} x2={xs[i]} y2={TOP + plotH} stroke={DISC_COLOR[k]} strokeWidth={3} opacity={0.28} strokeLinecap="round" />
        ))}
        {/* 底部基线 */}
        <line x1={PLOT_L} y1={TOP + plotH} x2={PLOT_R} y2={TOP + plotH} stroke="#a8b08c" strokeWidth={1} />
        {/* 顶部维度徽章 */}
        {keys.map((k, i) => {
          const inCombo = combo.includes(k);
          return (
            <g key={`badge-${k}`} opacity={inCombo ? 1 : 0.55}>
              <rect x={xs[i] - 21} y={TOP - 32} width={42} height={20} rx={6} fill={DISC_COLOR[k]} />
              <text x={xs[i]} y={TOP - 18} fontSize={11.5} fontWeight={700} fill="#ffffff" textAnchor="middle">
                {k}
              </text>
            </g>
          );
        })}
        {/* 落点连线 */}
        <polyline
          points={keys.map((k, i) => `${xs[i]},${yOf(tendency[k])}`).join(" ")}
          fill="none"
          stroke="#556339"
          strokeWidth={2}
          opacity={0.55}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* 落点 + 倾向度标签（正值落点用动物象徽：虎=D 老虎、孔=I 孔雀、考=S 考拉、枭=C 猫头鹰） */}
        {keys.map((k, i) => {
          const t = tendency[k];
          const positive = t > 0;
          const inRebound = Math.abs(t) >= DISC_REBOUND_PCT;
          const y = yOf(t);
          return (
            <g key={`dot-${k}`}>
              {inRebound && <circle cx={xs[i]} cy={y} r={13} fill="#6b7280" opacity={0.3} />}
              {positive ? (
                <>
                  <circle cx={xs[i]} cy={y} r={12} fill={DISC_COLOR[k]} stroke="#ffffff" strokeWidth={2.5} />
                  <text x={xs[i]} y={y + 4.2} fontSize={11} fontWeight={800} fill="#ffffff" textAnchor="middle">
                    {DISC_ANIMAL_BADGE[k]}
                  </text>
                </>
              ) : (
                <circle cx={xs[i]} cy={y} r={7} fill={DISC_COLOR[k]} stroke="#ffffff" strokeWidth={2.5} />
              )}
              <text x={xs[i]} y={y + (y > TOP + 30 ? -18 : 24)} fontSize={10.5} fontWeight={700} fill={DISC_COLOR[k]} textAnchor="middle">
                {discTendencyText(t)}
              </text>
            </g>
          );
        })}
      </svg>
      {/* 动物象徽图例 */}
      <p className="mt-1 text-center text-[11px] text-olive-mute">
        正值落点的动物象徽：虎 = D（{DISC_ANIMAL_FULL.D}）｜孔 = I（{DISC_ANIMAL_FULL.I}）｜考 = S（{DISC_ANIMAL_FULL.S}）｜枭 = C（{DISC_ANIMAL_FULL.C}）
      </p>
      {/* 底部类型标签（对标「ID（说服型）」样式） */}
      <div className="mx-auto -mt-1 w-fit rounded-lg border border-border bg-cream px-4 py-1 text-[13px] font-bold text-olive">
        {combo.join("")} 型{primaryReport ? `（${primaryReport.name}）` : ""}
      </div>
      {reboundHighDims.length > 0 && (
        <p className="mt-2 rounded-lg bg-[#6b7280]/10 px-3 py-1.5 text-[11.5px] leading-relaxed text-olive-soft">
          ⚠ 高反弹区：{reboundHighDims.map((k) => `${k}（${DISC_REBOUND_HIGH[k]}）`).join("、")}——强项拉满不等于无限好，物极必反，越是强项越要留意别用过头。
        </p>
      )}
      {reboundLowDims.length > 0 && (
        <p className="mt-2 rounded-lg bg-[#6b7280]/10 px-3 py-1.5 text-[11.5px] leading-relaxed text-olive-soft">
          ⚠ 低反弹区：{reboundLowDims.map((k) => `${k}（${DISC_REBOUND_LOW[k]}）`).join("、")}——长期把这一面压到极低，消耗大，也容易以反面形式反弹回来。
        </p>
      )}
      {/* 全量特征词阵：四个因子列各按本色高亮最典型的 5 个特征词（主因子组合列颜色更深） */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-4">
          {keys.map((k) => (
            <div key={k} className="py-1.5 text-center text-[13px] font-bold text-white" style={{ background: DISC_COLOR[k] }}>
              {k}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4">
          {keys.map((k) => {
            const inCombo = combo.includes(k);
            // 按该因子的倾向度定位：词阵从上到下 = 该因子最强→最弱，
            // 倾向度越高，高亮区越靠上；以倾向度对应位置为中心取 5 个词，主因子列底色更深
            const center = Math.round(((100 - tendency[k]) / 200) * (DISC_WORD_GRID[k].length - 1));
            const hiStart = Math.max(0, Math.min(DISC_WORD_GRID[k].length - 5, center - 2));
            const hiCount = 5;
            return (
              <div key={k} className="border-r border-border last:border-r-0">
                {DISC_WORD_GRID[k].map((w, wi) => {
                  const hit = wi >= hiStart && wi < hiStart + hiCount;
                  return (
                    <div
                      key={w}
                      className="border-b border-border/60 px-1 py-[3px] text-center text-[11px] leading-tight"
                      style={
                        hit
                          ? { background: `${DISC_COLOR[k]}${inCombo ? "40" : "22"}`, color: "#35421e", fontWeight: inCombo ? 800 : 600 }
                          : { color: "#8b9468" }
                      }
                    >
                      {w}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-olive-mute">
        每列词从上到下按该因子最强到最弱排列；高亮的 5 个词按你的倾向度定位（倾向度越高越靠上），主因子组合（{combo.join("")} 型）对应列底色更深。仅供对照理解，不代表逐词实测。
      </p>
      <p className="mt-1.5 rounded-lg bg-cream/70 px-3 py-2 text-[11.5px] leading-relaxed text-olive-soft">
        <b className="text-olive">这些关键词怎么读：</b>每一列是这个行为风格最常用的词，从上往下由「最典型」到「最不像」排列；彩色高亮的那 5
        个词，就是最贴近{plainWho}平时样子的词——不用逐词对号入座，抓住大意就好：偏「敢冲、说了算」是 D（老虎）气质，偏「热闹、爱表达」是
        I（孔雀）气质，偏「稳、慢热、配合」是 S（考拉）气质，偏「细、较真、讲规矩」是 C（猫头鹰）气质。类型没有好坏，只是每个人的默认档位不同。
      </p>
      <p className="mt-3 text-[12px] text-olive-mute">
        四因子倾向度：D {discTendencyText(tendency.D)} ｜ I {discTendencyText(tendency.I)} ｜ S {discTendencyText(tendency.S)} ｜ C {discTendencyText(tendency.C)}（-100%…+100%，合计恒为 0；原始倾向度，未做常模转换）。类型没有好坏，只代表当前状态下的行为倾向。
      </p>
    </div>
  );
}
