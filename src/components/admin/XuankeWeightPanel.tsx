/**
 * v221 选科评分权重调节面板（机构管理员）。
 * 学校版：选科统计分析页顶部「快捷通道」；通用版：后台管理「选科设置」页。
 * 口径：选科推荐得分 = 学科四维潜力 × (100 - 成绩权重)% + 成绩得分率 × 成绩权重%；
 * 调整后全机构学生报告、选科意向与统计立即按新权重重算（计算实时，不落库）。
 */
import { useEffect, useState } from "react";
import { SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { G } from "./SchoolConsole";

export default function XuankeWeightPanel({ canEdit, compact = false }: { canEdit: boolean; compact?: boolean }) {
  const { data } = trpc.school.xuankeWeight.get.useQuery();
  const utils = trpc.useUtils();
  const setW = trpc.school.xuankeWeight.set.useMutation({
    onSuccess: () => {
      utils.school.xuankeWeight.get.invalidate();
      utils.school.stats.selection.invalidate();
      utils.school.intentions.myOptions.invalidate();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    },
  });
  const [val, setVal] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (data && val == null) setVal(data.scoreWeight);
  }, [data, val]);
  const cur = val ?? data?.scoreWeight ?? 35;
  const dirty = data != null && cur !== data.scoreWeight;

  return (
    <div
      className="rounded-xl border bg-white p-4"
      style={{ borderColor: G.line, boxShadow: "0 1px 3px rgba(30,53,48,.05)" }}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} style={{ color: G.brand }} />
          <b className="text-[13.5px]" style={{ color: G.ink }}>
            选科评分权重
          </b>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ background: G.brandSoft, color: G.brand }}
          >
            成绩 {cur}% + 学科四维 {100 - cur}%
          </span>
        </div>
        {canEdit ? (
          <div className="flex min-w-[260px] flex-1 items-center gap-3">
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={cur}
              onChange={(e) => setVal(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-[#0E7A5F]"
            />
            <input
              type="number"
              min={0}
              max={60}
              value={cur}
              onChange={(e) => setVal(Math.max(0, Math.min(60, Math.round(Number(e.target.value) || 0))))}
              className="w-16 rounded-lg border px-2 py-1 text-center text-[13px] font-semibold outline-none"
              style={{ borderColor: G.line, color: G.ink }}
            />
            <span className="text-[12px]" style={{ color: G.mute }}>
              %
            </span>
            <button
              type="button"
              disabled={!dirty || setW.isPending}
              onClick={() => setW.mutate({ scoreWeight: cur })}
              className="rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition disabled:opacity-40"
              style={{ background: G.brand }}
            >
              {setW.isPending ? "保存中…" : dirty ? "保存生效" : "已生效"}
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: G.brand }}>
                <CheckCircle2 size={13} /> 已更新，全机构报告与统计即时重算
              </span>
            )}
          </div>
        ) : (
          <span className="text-[12px]" style={{ color: G.mute }}>
            仅机构管理员可调整
          </span>
        )}
      </div>
      {!compact && (
        <p className="mt-2.5 text-[12px] leading-relaxed" style={{ color: G.mute }}>
          选科推荐得分 = 学科四维潜力 × (100 - 成绩权重)% + 考试成绩得分率 × 成绩权重%。范围 0–60%：0%
          为纯测评推荐，越大越看重考试成绩。保存后本机构所有学生的报告、意向确认与选科统计立即按新权重重新计算。
        </p>
      )}
      {setW.isError && (
        <p className="mt-2 text-[12px] font-medium" style={{ color: G.danger }}>
          保存失败：{(setW.error as Error)?.message ?? "请再试一次"}
        </p>
      )}
    </div>
  );
}
