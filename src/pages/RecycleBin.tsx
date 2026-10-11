import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { RotateCcw, Trash2, GraduationCap } from "lucide-react";

/**
 * v96 · 回收站（/recycle-bin）：已删除、尚在 2 个月保留期内的学员。
 * 打开本页会先自动清扫一次到期数据（超期未恢复的学员已被物理清除，无法再列出）。
 * 管理员看本机构（超管看全量）；伴学师看自己名下被删的学员。
 */
export default function RecycleBin() {
  const { user } = useAuth();
  const allowed = user?.role === "tutor" || user?.role === "admin";
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.coach.recycleBin.useQuery(undefined, { enabled: allowed });
  const restore = trpc.coach.restoreStudent.useMutation({
    onSuccess: () => {
      void utils.coach.recycleBin.invalidate();
      void utils.coach.myStudents.invalidate();
      void utils.admin.students.invalidate();
    },
  });

  if (!allowed) {
    return (
      <div className="mx-auto mt-16 max-w-md">
        <div className="paper-card p-8 text-center">
          <Trash2 className="mx-auto text-olive" size={34} />
          <h1 className="mt-3 text-[19px] font-bold text-olive">回收站</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-mute">回收站需要伴学师或管理员权限。</p>
        </div>
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-[22px] font-bold tracking-tight text-olive">
          <Trash2 size={22} className="text-olive-mute" />
          回收站
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-olive-mute">
          已删除的学员在这里保留 <b className="text-olive">2 个月</b>：期间可随时恢复（学员即可正常登录、数据原样）；
          到期未恢复的将<b className="text-olive">自动彻底删除，不可找回</b>。
          {data && data.purged > 0 && (
            <span className="ml-1 font-semibold text-[#8f1313]">本次已自动清理 {data.purged} 位到期学员。</span>
          )}
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <p className="paper-card px-5 py-10 text-center text-[13px] text-olive-mute">回收站是空的——没有被删除的学员。</p>
      ) : (
        <div className="grid gap-3">
          {items.map((s) => (
            <div key={s.userId} className="paper-card flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-mute/30 text-[15px] font-bold text-olive">
                {(s.name || "学")[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-olive">{s.name}</span>
                  {s.grade && <span className="text-[12px] text-olive-mute">{s.grade}</span>}
                  {s.phone && <span className="mono text-[11.5px] text-olive-mute">{s.phone}</span>}
                </div>
                <div className="mt-0.5 text-[11.5px] text-olive-mute">
                  删除于 {new Date(s.deletedAt).toLocaleString("zh-CN")}
                  {s.deletedByName && <> · 由 {s.deletedByName} 删除</>}
                  <span className={s.remainingDays <= 7 ? "font-semibold text-[#8f1313]" : ""}>
                    {" "}· 还剩 {s.remainingDays} 天自动彻底清除
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={restore.isPending}
                onClick={() => restore.mutate({ userId: s.userId })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-cream hover:bg-lime disabled:opacity-50"
              >
                <RotateCcw size={13} />
                {restore.isPending ? "恢复中…" : "恢复学员"}
              </button>
            </div>
          ))}
        </div>
      )}

      {restore.error && (
        <p className="text-[12.5px] text-terra">{restore.error.message}</p>
      )}
      <p className="flex items-center gap-1.5 text-[11.5px] text-olive-mute">
        <GraduationCap size={12} />
        提示：彻底删除由系统自动执行（服务启动时与每次打开本页时检查），无需手动操作。
      </p>
    </div>
  );
}
