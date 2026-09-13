import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { GRADES } from "@contracts/constants";
import { Minus, Plus } from "lucide-react";

/** 向导第 1 阶段：认识一下（基础档案）。 */
export default function ProfileStage({ onNext }: { onNext: () => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("初一");
  const [school, setSchool] = useState("");
  const [targetSchool, setTargetSchool] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(45);

  const setup = trpc.profile.setup.useMutation({
    onSuccess: () => {
      utils.profile.get.invalidate();
      onNext();
    },
  });

  const valid = name.trim().length > 0;

  const inputCls =
    "mt-2 w-full rounded-xl border border-input bg-cream px-4 py-2.5 text-[15px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25";

  return (
    <div className="paper-card p-6">
      <h2 className="text-lg font-bold text-olive">先认识一下你</h2>
      <p className="mt-1 text-[14px] text-olive-soft">几句话就好，后面的计划都会照着你的情况来安排。</p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="mono text-[11px] tracking-wider text-olive-mute">怎么称呼你？</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名字或喜欢的称呼"
            maxLength={32}
            className={inputCls}
          />
        </div>

        <div>
          <label className="mono text-[11px] tracking-wider text-olive-mute">你读几年级？</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputCls}>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mono text-[11px] tracking-wider text-olive-mute">学校（选填）</label>
            <input
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="现在读的学校"
              maxLength={64}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mono text-[11px] tracking-wider text-olive-mute">自己的目标学校（选填）</label>
            <input
              value={targetSchool}
              onChange={(e) => setTargetSchool(e.target.value)}
              placeholder="心里的那所学校"
              maxLength={64}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="mono text-[11px] tracking-wider text-olive-mute">每天大概能挤出多少分钟给自己？</label>
          <div className="mt-2 flex items-center gap-4 rounded-xl border border-border bg-cream px-4 py-3">
            <button
              type="button"
              aria-label="减少 5 分钟"
              onClick={() => setDailyMinutes((m) => Math.max(15, m - 5))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-cream-card text-olive hover:bg-lime-pale"
            >
              <Minus size={16} />
            </button>
            <div className="flex-1 text-center">
              <span className="mono text-2xl font-bold text-olive">{dailyMinutes}</span>
              <span className="ml-1 text-[13px] text-olive-mute">分钟 / 天</span>
            </div>
            <button
              type="button"
              aria-label="增加 5 分钟"
              onClick={() => setDailyMinutes((m) => Math.min(120, m + 5))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-cream-card text-olive hover:bg-lime-pale"
            >
              <Plus size={16} />
            </button>
          </div>
          <p className="mt-1.5 text-[12.5px] text-olive-mute">15-120 分钟都行，宁少勿多，能坚持的才算数。</p>
        </div>
      </div>

      <button
        disabled={!valid || setup.isPending}
        onClick={() =>
          setup.mutate({
            name: name.trim(),
            grade,
            school: school.trim() || undefined,
            targetSchool: targetSchool.trim() || undefined,
            dailyMinutes,
          })
        }
        className="mt-6 w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-50"
      >
        {setup.isPending ? "保存中…" : "下一步 →"}
      </button>
      {setup.isError && <p className="mt-2 text-center text-[13px] text-terra">保存没成功，再点一次试试。</p>}
    </div>
  );
}
