import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Minus, Plus, RotateCcw, Target } from "lucide-react";

/** 伴学师 · 我的档案：基础信息 + 每日时长可改 + 测评标签。 */
export default function ProfileCard() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.profile.get.useQuery();

  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    if (profile && minutes === null) setMinutes(profile.dailyMinutes);
  }, [profile, minutes]);

  const update = trpc.profile.updateMinutes.useMutation({
    onSuccess: () => utils.profile.get.invalidate(),
  });

  if (isLoading) {
    return <div className="paper-card h-40 animate-pulse bg-cream-deep/50" />;
  }
  if (!profile) {
    return (
      <div className="paper-card p-8 text-center">
        <p className="font-semibold text-olive">还没有档案</p>
        <p className="mt-1 text-sm text-olive-mute">先花两分钟认识一下，之后的计划才好量体裁衣。</p>
        <button
          onClick={() => navigate("/welcome")}
          className="mt-4 rounded-xl bg-olive px-5 py-2.5 text-sm font-semibold text-cream hover:bg-lime"
        >
          去建立档案 →
        </button>
      </div>
    );
  }

  const cur = minutes ?? profile.dailyMinutes;
  const dirty = cur !== profile.dailyMinutes;

  return (
    <div className="paper-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-olive">{profile.name}</span>
            <span className="chip">{profile.grade}</span>
          </div>
          <p className="mt-1.5 text-[13.5px] text-olive-soft">
            {profile.school ?? "学校未填写"}
            {profile.targetSchool && (
              <>
                {" · "}
                <Target size={13} className="mb-0.5 inline text-terra" /> 想考 {profile.targetSchool}
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => navigate("/welcome")}
          className="flex items-center gap-1.5 rounded-xl border border-olive px-3.5 py-2 text-[13px] font-medium text-olive hover:bg-lime-pale"
        >
          <RotateCcw size={14} />
          重新测评
        </button>
      </div>

      {/* 测评标签 */}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="chip">MBTI · {profile.mbti ?? "未测"}</span>
        <span className="chip">DISC · {profile.disc ?? "未测"}</span>
        <span className="chip">E3 诊断 · {profile.diagnosis ? "已完成" : "未测"}</span>
      </div>

      {/* 每日时长 */}
      <div className="mt-5 rounded-xl border border-border bg-cream p-4">
        <div className="mono text-[11px] tracking-wider text-olive-mute">每天给自己留的学习时间</div>
        <div className="mt-2 flex items-center gap-4">
          <button
            type="button"
            aria-label="减少 5 分钟"
            onClick={() => setMinutes(Math.max(10, cur - 5))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-cream-card text-olive hover:bg-lime-pale"
          >
            <Minus size={16} />
          </button>
          <div className="flex-1 text-center">
            <span className="mono text-2xl font-bold text-olive">{cur}</span>
            <span className="ml-1 text-[13px] text-olive-mute">分钟 / 天</span>
          </div>
          <button
            type="button"
            aria-label="增加 5 分钟"
            onClick={() => setMinutes(Math.min(240, cur + 5))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-cream-card text-olive hover:bg-lime-pale"
          >
            <Plus size={16} />
          </button>
        </div>
        {dirty && (
          <button
            disabled={update.isPending}
            onClick={() => update.mutate({ dailyMinutes: cur })}
            className="mt-3 w-full rounded-xl bg-olive py-2.5 text-sm font-semibold text-cream hover:bg-lime disabled:opacity-50"
          >
            {update.isPending ? "保存中…" : "保存新的时长"}
          </button>
        )}
        {!dirty && update.isSuccess && <p className="mt-2 text-center text-[12.5px] text-lime">已保存，明天开始按新节奏安排。</p>}
      </div>
    </div>
  );
}
