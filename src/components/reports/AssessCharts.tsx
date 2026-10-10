/**
 * V77 升学报告 4.1：各测评图表化组件。
 * 霍兰德六型雷达 / MBTI 四维度双极条 / DISC 四型条 / 职业锚八型条 / 多元智能五维雷达。
 * 均为无框图块（外层由 4.1 卡片包裹），配色沿用报告橄榄绿主题。
 */
import { Bar, BarChart, Cell, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { HollandResult } from "@contracts/holland";
import { HOLLAND_LABEL, HOLLAND_ORDER } from "@contracts/holland";
import type { MbtiResult } from "@contracts/assessments";
import type { DiscResult, DiscType } from "@contracts/assessments";
import type { AnchorResult, AnchorKey } from "@contracts/careerAnchor";
import { ANCHOR_LABEL, ANCHOR_ORDER } from "@contracts/careerAnchor";
import type { Multi5Result } from "@contracts/multi5";
import { MULTI5_DIM_LABEL, MULTI5_DIM_ORDER } from "@contracts/multi5";

const OLIVE = "#595959";
const GRID = "#eceef1";
const LIME = "#ed4e38";
const SKY = "#3d8ec4";
const AMBER = "#f2a65a";
const TERRA = "#c05a3a";

function BlockTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] font-bold text-olive">{children}</p>;
}

/* ---------------- 霍兰德六型雷达 ---------------- */

export function HollandRadar({ result, height = 230 }: { result: HollandResult; height?: number }) {
  const top = new Set(result.top3);
  const data = HOLLAND_ORDER.map((k) => ({
    label: `${HOLLAND_LABEL[k]} ${result.dims[k]}`,
    得分: result.dims[k],
    hot: top.has(k),
  }));
  return (
    <div>
      <BlockTitle>职业兴趣六型雷达（{result.code}）</BlockTitle>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="68%">
            <PolarGrid stroke={GRID} />
            <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
            <PolarAngleAxis
              dataKey="label"
              tick={({ x, y, payload }: any) => {
                const d = data.find((dd) => dd.label === payload.value);
                const [name, score] = String(payload.value).split(" ");
                return (
                  <text x={x} y={y} textAnchor="middle" fontSize={11}>
                    <tspan fill={d?.hot ? LIME : OLIVE} fontWeight={700}>{name}</tspan>
                    <tspan dx={3} fill={d?.hot ? LIME : "#999999"} fontWeight={700}>{score}</tspan>
                  </text>
                );
              }}
            />
            <Radar dataKey="得分" stroke={LIME} fill={LIME} fillOpacity={0.28} strokeWidth={2.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] leading-relaxed text-olive-mute">绿色 = 兴趣代码 Top3（{result.top3.map((k) => HOLLAND_LABEL[k]).join("、")}），是选专业时最该尊重的方向。</p>
    </div>
  );
}

/* ---------------- MBTI 四维度双极条 ---------------- */

const MBTI_PAIRS: [string, string, string][] = [
  ["精力来源", "E", "I"],
  ["认知方式", "S", "N"],
  ["决策方式", "T", "F"],
  ["生活方式", "J", "P"],
];

export function MbtiBars({ result }: { result: MbtiResult }) {
  const d = result.dims;
  return (
    <div>
      <BlockTitle>性格四维度倾向（{result.type}）</BlockTitle>
      <div className="mt-2 space-y-2">
        {MBTI_PAIRS.map(([label, a, b]) => {
          const av = d[a as "E"] ?? 0;
          const bv = d[b as "I"] ?? 0;
          const sum = av + bv || 1;
          return (
            <div key={label}>
              <div className="flex items-baseline justify-between text-[11.5px]">
                <span className="font-bold" style={{ color: av >= bv ? SKY : OLIVE }}>{a} {av >= bv ? "◀" : ""}</span>
                <span className="text-olive-mute">{label}</span>
                <span className="font-bold" style={{ color: bv > av ? SKY : OLIVE }}>{bv > av ? "▶" : ""} {b}</span>
              </div>
              <div className="mt-0.5 flex h-2.5 overflow-hidden rounded-full bg-olive/8">
                <div className="h-full rounded-l-full" style={{ width: `${(av / sum) * 100}%`, background: av >= bv ? SKY : "#c9c9c9" }} />
                <div className="h-full rounded-r-full" style={{ width: `${(bv / sum) * 100}%`, background: bv > av ? SKY : "#c9c9c9" }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-olive-mute">蓝色一侧为当前主导倾向；性格无好坏，重要的是按自己的方式高效学习。</p>
    </div>
  );
}

/* ---------------- DISC 四型条 ---------------- */

const DISC_META: Record<DiscType, { label: string; color: string; desc: string }> = {
  D: { label: "支配型", color: TERRA, desc: "目标快、敢挑战" },
  I: { label: "影响型", color: AMBER, desc: "热情、善带动" },
  S: { label: "稳健型", color: LIME, desc: "耐心、重协作" },
  C: { label: "谨慎型", color: SKY, desc: "严谨、重逻辑" },
};

export function DiscBars({ result }: { result: DiscResult }) {
  const data = (Object.keys(DISC_META) as DiscType[]).map((k) => ({
    label: DISC_META[k].label,
    key: k,
    得分: result.dims[k],
  }));
  return (
    <div>
      <BlockTitle>行为风格四型分布（主导 {DISC_META[result.primary].label}）</BlockTitle>
      <div className="mt-2" style={{ height: 132 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="label" width={58} tick={{ fontSize: 11, fill: OLIVE }} />
            <Bar dataKey="得分" radius={[0, 6, 6, 0]} barSize={16}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.key === result.primary ? DISC_META[d.key as DiscType].color : "#c9cfae"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] leading-relaxed text-olive-mute">
        {(Object.keys(DISC_META) as DiscType[]).map((k) => `${DISC_META[k].label}：${DISC_META[k].desc}`).join("；")}。
      </p>
    </div>
  );
}

/* ---------------- 职业锚八型条 ---------------- */

export function AnchorBars({ result, height = 210 }: { result: AnchorResult; height?: number }) {
  const top = new Set(result.top2);
  const data = ANCHOR_ORDER.map((k: AnchorKey) => ({ label: ANCHOR_LABEL[k], key: k, 得分: result.dims[k] }));
  return (
    <div>
      <BlockTitle>职业价值观八锚（Top：{result.top2.map((k) => ANCHOR_LABEL[k]).join("、")}）</BlockTitle>
      <div className="mt-2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
            <XAxis type="number" domain={[0, 5]} hide />
            <YAxis type="category" dataKey="label" width={76} tick={{ fontSize: 11, fill: OLIVE }} />
            <Bar dataKey="得分" radius={[0, 6, 6, 0]} barSize={13}>
              {data.map((d) => (
                <Cell key={d.key} fill={top.has(d.key as AnchorKey) ? AMBER : "#d5d9bd"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] leading-relaxed text-olive-mute">金色 = 主导职业锚——选专业时「最看重什么」比「能做什么」更影响长期满意度。</p>
    </div>
  );
}

/* ---------------- 多元智能五维雷达 ---------------- */

export function Multi5Radar({ result, height = 220 }: { result: Multi5Result; height?: number }) {
  const data = MULTI5_DIM_ORDER.map((k) => ({
    label: `${MULTI5_DIM_LABEL[k]} ${result.dims[k]}`,
    得分: result.dims[k],
  }));
  return (
    <div>
      <BlockTitle>学习智能五维雷达（综合 {result.overall} 分）</BlockTitle>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="68%">
            <PolarGrid stroke={GRID} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: OLIVE }} />
            <Radar dataKey="得分" stroke={SKY} fill={SKY} fillOpacity={0.25} strokeWidth={2.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] leading-relaxed text-olive-mute">得分越高代表该智能越突出，扬长比补短更有效。</p>
    </div>
  );
}

/* ---------------- V78 学科能力测评图表 ---------------- */

import type { SubjectAssessmentResult } from "@contracts/subjectAssessment";

/** 九科综合均分雷达（左图口径：一眼看全科全貌）。 */
export function SubjectOverallRadar({ result, height = 240 }: { result: SubjectAssessmentResult; height?: number }) {
  const worst = new Set(result.weakestStages.map((w) => w.subject));
  const data = result.subjects.map((s) => ({
    label: `${s.name} ${s.overall}`,
    得分: s.overall,
    weak: worst.has(s.name) || s.overall < 3.5,
  }));
  return (
    <div>
      <BlockTitle>九科综合均分雷达（总均 {result.totalAvg}/5）</BlockTitle>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="70%">
            <PolarGrid stroke={GRID} />
            <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
            <PolarAngleAxis
              dataKey="label"
              tick={({ x, y, payload }: any) => {
                const d = data.find((dd) => dd.label === payload.value);
                const [name, score] = String(payload.value).split(" ");
                return (
                  <text x={x} y={y} textAnchor="middle" fontSize={11}>
                    <tspan fill={d?.weak ? TERRA : OLIVE} fontWeight={700}>{name}</tspan>
                    <tspan dx={3} fill={d?.weak ? TERRA : "#999999"} fontWeight={700}>{score}</tspan>
                  </text>
                );
              }}
            />
            <Radar dataKey="得分" stroke={LIME} fill={LIME} fillOpacity={0.28} strokeWidth={2.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] leading-relaxed text-olive-mute">红色标注 = 综合偏弱（&lt;3.5）或含最弱环节的学科。</p>
    </div>
  );
}

/** 学科 × 环节对比条图（右图口径：听懂/记住/运用（+特定）在各科的分布，薄弱环节一目了然）。 */
export function SubjectStageBars({ result, height = 240 }: { result: SubjectAssessmentResult; height?: number }) {
  const stageKeys = [...new Set(result.subjects.flatMap((s) => s.stages.map((st) => st.stage)))] as string[];
  const colors: Record<string, string> = { 听懂: LIME, 记住: SKY, 运用: AMBER, 特定: TERRA };
  const data = result.subjects.map((s) => {
    const row: Record<string, number | string> = { subject: s.name };
    for (const st of s.stages) row[st.stage] = st.avg;
    return row;
  });
  return (
    <div>
      <BlockTitle>听懂 / 记住 / 运用 · 各环节在各科的对比</BlockTitle>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <XAxis dataKey="subject" tick={{ fontSize: 11, fill: OLIVE }} />
            <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: "#999999" }} />
            {stageKeys.map((k) => (
              <Bar key={k} dataKey={k} fill={colors[k] ?? "#c9c9c9"} radius={[3, 3, 0, 0]} barSize={12} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] leading-relaxed text-olive-mute">
        {stageKeys.map((k) => `${k}（${{ 听懂: "课堂输入", 记住: "复习巩固", 运用: "练习输出", 特定: "学科特定规划" }[k] ?? k}）`).join(" · ")}
        ，最矮的那根就是该科先补的环节。
      </p>
    </div>
  );
}
