import type { ReactNode } from "react";
import { HeartHandshake, Compass } from "lucide-react";
import type { E3V27Result, E3Level } from "@contracts/assessments";

const DIM_COLORS: Record<string, string> = {
  乐学: "#7cb83c",
  会学: "#cfe07a",
  善学: "#556339",
  品格: "#e8a33d",
  环境: "#8b9468",
};

const LEVEL_CLASS: Record<E3Level, string> = {
  正常: "border-lime/50 bg-lime-pale text-olive",
  警戒: "border-butter bg-butter/60 text-olive",
  危险: "border-terra/40 bg-terra/10 text-terra",
};

/** E3 学业诊断 V2.7 结果卡（Welcome 完成页与伴学师测评报告共用）。 */
export default function E3ResultCard({ result, action }: { result: E3V27Result; action?: ReactNode }) {
  return (
    <div className="space-y-4">
      {/* 五维得分条 */}
      <div className="paper-card p-5">
        <h3 className="font-bold text-olive">五维学习能力（{result.stageLabel}）</h3>
        <p className="mt-0.5 text-[13px] text-olive-mute">
          乐学（动力与目标）· 会学（习惯与流程）· 善学（元认知·能力·AI）· 品格（心理韧性）· 环境（身心与支持）
        </p>
        <div className="mt-4 space-y-3">
          {result.dims.map((d) => (
            <div key={d.key} className="flex items-center gap-3">
              <span className="w-10 shrink-0 text-[14px] font-semibold text-olive">{d.key}</span>
              <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (d.score / 5) * 100)}%`, backgroundColor: DIM_COLORS[d.key] }}
                />
              </div>
              <span className="mono w-16 text-right text-[13px] text-olive-soft">
                {d.score.toFixed(1)} <span className="text-[11px]">{d.level}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center rounded-xl bg-olive py-2.5">
          <span className="text-[16px] font-bold tracking-wide text-cream">五维定位：{result.priority}</span>
        </div>
      </div>

      {/* 二级观察点涂档 */}
      <div className="paper-card p-5">
        <h3 className="font-bold text-olive">二级观察点</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {result.subscales.map((n) => (
            <div key={n.key} className={`rounded-xl border px-3 py-2 ${LEVEL_CLASS[n.level]}`}>
              <div className="text-[13px] font-medium">{n.label}</div>
              <div className="mono mt-0.5 flex items-baseline gap-1.5 text-[12px]">
                <span className="font-bold">{n.score.toFixed(1)}</span>
                <span className="opacity-80">{n.level}</span>
              </div>
            </div>
          ))}
          <div
            className={`rounded-xl border px-3 py-2 ${
              result.extDriveHigh
                ? "border-terra/40 bg-terra/10 text-terra"
                : "border-lime/50 bg-lime-pale text-olive"
            }`}
          >
            <div className="text-[13px] font-medium">外驱依赖指数</div>
            <div className="mono mt-0.5 flex items-baseline gap-1.5 text-[12px]">
              <span className="font-bold">{result.extDrive.toFixed(1)}</span>
              <span className="opacity-80">{result.extDriveHigh ? "偏高" : "正常"}</span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-olive-mute">
          学习状态单选「{result.motivationLabel}」（赋分 {result.motivationScore}）
          {result.interestOnline ? " · 兴趣在线" : ""}；生活事件 {result.lifeEventScore}/24（{result.lifeEventLevel}）
        </p>
      </div>

      {/* 训练方向 */}
      {result.routes.length > 0 && (
        <div className="paper-card accent-l border-lime p-5">
          <div className="flex items-center gap-2">
            <Compass size={17} className="text-olive" />
            <h3 className="font-bold text-olive">优先训练方向</h3>
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {result.routes.slice(0, 5).map((r, i) => (
              <li key={i} className="text-[14px] leading-relaxed text-olive-soft">
                <span className="font-semibold text-olive">{r.issue}</span> → {r.action}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 红线温和提示 */}
      {result.redFlags.length > 0 && (
        <div className="paper-card accent-l border-butter bg-butter/30 p-5">
          <div className="flex items-center gap-2">
            <HeartHandshake size={17} className="text-terra" />
            <h3 className="font-bold text-olive">最近是不是有点累？</h3>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-olive">
            树洞随时可以说说话。也有些话值得让爸爸妈妈知道——
          </p>
          <ul className="mt-2 space-y-1.5">
            {result.redFlags.map((f, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-olive-soft">
                · {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-[12.5px] text-olive-mute">
        本测评为初始定位，建议每 8 周用同表复测一次，与首测对比校准。
      </p>

      {action}
    </div>
  );
}
