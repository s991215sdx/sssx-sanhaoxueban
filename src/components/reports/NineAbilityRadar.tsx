/**
 * 九能雷达图（V3.7 三阶九能）：9 轴 动力/信心/韧劲 · 学懂/记住/会用 · 计划/复盘/智学。
 * 标签带分数，分数按新阈值着色（红 <3.0 卡点 / 黄 3.0-3.7 待提升 / 绿 ≥3.8 正常）。
 * 按三阶分组配色描边填充。
 */
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import type { E3V37Result } from "@contracts/e3v37";
import { E3V37_LEVEL_STYLE, E3V37_LEVEL_CAPTION } from "./e3v37Theme";

/** 三阶分组配色（乐学/会学/善学）。 */
const SYSTEM_COLOR: Record<string, string> = {
  乐学: "#7cb83c",
  会学: "#3d8ec4",
  善学: "#c7a23a",
};

export default function NineAbilityRadar({
  e3,
  height = 280,
  abilities,
  title = "三阶九能 · 九能雷达",
}: {
  e3: E3V37Result;
  height?: number;
  /** 只画传入的九能子集（如某阶三能的小雷达）；缺省画全部九能。 */
  abilities?: E3V37Result["abilities"];
  title?: string;
}) {
  const list = abilities ?? e3.abilities;
  const data = list.map((a) => ({
    dim: a.label,
    label: `${a.label} ${a.score}`,
    得分: a.score,
    level: a.level,
    system: a.system,
  }));
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">{title}</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">
        乐学（动力/信心/韧劲，绿轴标）· 会学（学懂/记住/会用，蓝轴标）· 善学（计划/复盘/智学，金轴标）；{E3V37_LEVEL_CAPTION}。
      </p>
      <div className="mt-2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="68%">
            <PolarGrid stroke="#d9dcb8" />
            <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
            <PolarAngleAxis
              dataKey="label"
              tick={({ x, y, payload }: any) => {
                const d = data.find((dd) => dd.label === payload.value);
                const lvColor = d ? E3V37_LEVEL_STYLE[d.level as keyof typeof E3V37_LEVEL_STYLE].text : "#556339";
                const sysColor = d ? SYSTEM_COLOR[d.system] : "#556339";
                const [name, score] = String(payload.value).split(" ");
                return (
                  <text x={x} y={y} textAnchor="middle" fontSize={11}>
                    <tspan fill={sysColor} fontWeight={700}>{name}</tspan>
                    <tspan dx={3} fill={lvColor} fontWeight={700}>{score}</tspan>
                  </text>
                );
              }}
            />
            <Radar dataKey="得分" stroke="#7cb83c" fill="#7cb83c" fillOpacity={0.3} strokeWidth={2.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
