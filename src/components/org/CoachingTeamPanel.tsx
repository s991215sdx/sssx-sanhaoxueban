import { useEffect, useMemo, useState } from "react";
import { Check, ShieldCheck, Users } from "lucide-react";
import { COACHING_SERVICE_ROLES, coachingServiceRoleLabel, type CoachingServiceRole } from "@contracts/coachingTeam";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { CoachingPanel } from "./CoachingV4";
import { invalidateCoachingOperations } from "./coachingRefresh";
import type { CoachingDetail } from "./coachingTypes";

const input = "mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]";
const primary = "min-h-10 rounded-xl bg-[#0C7064] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40";

function roleNames(roles: string[]) {
  return roles.map(coachingServiceRoleLabel).join("、");
}

/** 同一主档的团队关系；完整查看权与各业务修改权分开。 */
export default function CoachingTeamPanel({ data, compact = false }: { data: CoachingDetail; compact?: boolean }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: staff = [], error: staffError } = trpc.coaching.staff.useQuery(undefined, { enabled: !compact });
  const active = data.serviceTeam.filter((row) => row.active);
  const activeSignature = active.map((row) => `${row.userId}:${row.serviceRole}`).sort().join("|");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(activeSignature ? activeSignature.split("|") : []));
  const [reason, setReason] = useState("");
  useEffect(() => { setSelected(new Set(activeSignature ? activeSignature.split("|") : [])); setReason(""); }, [activeSignature, data.coachingCase.id]);
  const grouped = useMemo(() => COACHING_SERVICE_ROLES.map((role) => ({
    ...role,
    members: active.filter((row) => row.serviceRole === role.key),
  })), [activeSignature]);
  const refresh = async () => {
    await Promise.all([
      utils.coaching.detail.invalidate({ caseId: data.coachingCase.id }),
      utils.coaching.cases.invalidate(),
      utils.coaching.staff.invalidate(),
      invalidateCoachingOperations(utils),
    ]);
  };
  const save = trpc.coaching.saveCaseTeam.useMutation({ onSuccess: async () => { setReason(""); await refresh(); } });
  const toggle = (userId: number, role: CoachingServiceRole) => {
    if (user?.role !== "admin") return;
    if ((userId === data.coachingCase.coachId && role === "coach") || (userId === data.coachingCase.supervisorId && role === "supervisor")) return;
    const key = `${userId}:${role}`;
    setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };
  const assignments = [...selected].map((key) => {
    const [userId, serviceRole] = key.split(":");
    return { userId: Number(userId), serviceRole: serviceRole as CoachingServiceRole };
  });
  const teamList = <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{grouped.map((group) => <section key={group.key} className="rounded-xl border border-[#E7E2D0] bg-cream/40 p-3">
    <h4 className="text-[12px] font-bold text-olive">{group.label}<span className="ml-1.5 font-normal text-olive-mute">{group.members.length} 人</span></h4>
    <p className="mt-1 text-[10px] leading-relaxed text-olive-mute">{group.responsibility}</p>
    <div className="mt-2 space-y-1.5">{group.members.map((member) => <div key={member.id} className="flex items-center gap-1.5 text-[11.5px] text-olive-soft"><Check size={12} className="shrink-0 text-[#0C7064]" /><span className="min-w-0 flex-1 break-words">{member.name ?? `员工 #${member.userId}`}</span></div>)}{!group.members.length && <p className="text-[11px] text-olive-mute">尚未分配</p>}</div>
  </section>)}</div>;

  if (compact) return <CoachingPanel title="本学员服务团队" subtitle="咨询师、伴学师、督学师、学习教练及管理员按当前分配共同服务">
    {teamList}
    <p className="mt-3 text-[10.5px] leading-relaxed text-olive-mute">当前有效成员可查看本学员完整陪跑信息；下月计划与当月总结仍按各自职责办理。</p>
  </CoachingPanel>;

  return <CoachingPanel title="学员服务团队与职能分配" subtitle="一名员工可承担多种职能；一名学员可分配多名督学师和学习教练" action={<ShieldCheck size={18} className="text-[#0C7064]" />}>
    <div className="mb-3 rounded-xl bg-mint-pale/30 p-3 text-[11px] leading-relaxed text-olive-soft">当前有效成员均可查看该学员的档案、测评、规划、执行、成长、家校和团队信息。管理员负责下月计划，督学师／学习教练负责当月总结；停用团队关系后立即收回该团队访问权限，历史分配仍保留。</div>
    {teamList}
    {staffError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-[11px] text-red-700">{staffError.message}</p>}
    {user?.role === "admin" ? <>
      <details className="mt-4 rounded-xl border border-[#E7E2D0] bg-cream/25 p-3" open>
        <summary className="cursor-pointer text-[12.5px] font-bold text-olive">调整本学员服务团队</summary>
        <p className="mt-2 text-[10.5px] leading-relaxed text-olive-mute">勾选员工在本学员处承担的职能。主学习教练和主督学负责人不能直接移除，须先完成管理员改派与接收。</p>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left text-[11px]">
          <thead><tr className="bg-cream text-olive-mute"><th className="rounded-l-lg px-3 py-2">员工</th>{COACHING_SERVICE_ROLES.map((role) => <th key={role.key} className="px-2 py-2 text-center last:rounded-r-lg">{role.label}</th>)}</tr></thead>
          <tbody>{staff.map((person) => <tr key={person.id} className="border-b border-border/60"><td className="px-3 py-2.5"><b className="block text-olive">{person.name}</b><span className="text-[10px] font-normal text-olive-mute">账号职能：{roleNames(person.serviceRoles)}</span></td>{COACHING_SERVICE_ROLES.map((role) => {
            const key = `${person.id}:${role.key}`;
            const primaryOwner = (person.id === data.coachingCase.coachId && role.key === "coach") || (person.id === data.coachingCase.supervisorId && role.key === "supervisor");
            const unavailable = role.key === "admin" && person.role !== "admin";
            return <td key={role.key} className="px-2 py-2.5 text-center"><input type="checkbox" aria-label={`${person.name} ${role.label}`} checked={selected.has(key)} disabled={unavailable || primaryOwner} title={primaryOwner ? "主负责人请走改派流程" : unavailable ? "仅真实管理员账号可分配管理员职能" : `设置${role.label}`} onChange={() => toggle(person.id, role.key)} className="h-4 w-4 accent-[#0C7064] disabled:opacity-30" /></td>;
          })}</tr>)}</tbody>
        </table></div>
        <label className="mt-3 block text-[11.5px] font-semibold text-olive">团队调整原因（必填）<textarea aria-label="团队调整原因" value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={2000} placeholder="说明新增、停用或职能调整的原因与服务衔接安排" className={input} /></label>
        <button type="button" disabled={save.isPending || reason.trim().length < 2} onClick={() => save.mutate({ caseId: data.coachingCase.id, assignments, reason })} className={`${primary} mt-2 w-full`}>{save.isPending ? "正在保存…" : "保存本学员服务团队"}</button>
        {save.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2.5 text-[11px] text-red-700">{save.error.message}</p>}
        {save.isSuccess && <p role="status" className="mt-2 text-[11px] text-[#2F7A41]">团队已保存，共 {save.data.activeCount} 条有效职能关系。</p>}
      </details>
      <details className="mt-3 rounded-xl border border-[#E7E2D0] bg-cream/25 p-3"><summary className="cursor-pointer text-[12.5px] font-bold text-olive">配置员工可承担职能</summary><p className="mt-2 text-[10.5px] text-olive-mute">这里维护员工职能清单，不等于分配到本学员；本学员团队请在上方逐人勾选。</p><div className="mt-3 space-y-2">{staff.map((person) => <StaffRoleEditor key={`${person.id}:${person.serviceRoles.join(",")}`} person={person} onSaved={refresh} />)}</div></details>
    </> : <p className="mt-3 rounded-lg bg-cream/50 p-3 text-[11px] text-olive-mute">团队分配由管理员维护。你可以查看本学员完整服务资料；具体录入权限以各业务职责为准。</p>}
    <details className="mt-3 rounded-xl bg-cream/35 p-3"><summary className="cursor-pointer text-[12px] font-semibold text-olive">历史停用记录（{data.serviceTeam.filter((row) => !row.active).length}）</summary><div className="mt-2 space-y-2">{data.serviceTeam.filter((row) => !row.active).map((row) => <article key={row.id} className="rounded-lg bg-white p-2.5 text-[11px] leading-relaxed text-olive-soft"><b>{row.name ?? `员工 #${row.userId}`} · {row.serviceRoleLabel}</b><span className="ml-2 text-olive-mute">已停用</span><p className="mt-1">原因：{row.changeReason || "未记录"}</p><p className="text-[10px] text-olive-mute">停用时间：{row.endedAt ? new Date(row.endedAt).toLocaleString("zh-CN") : "未记录"}</p></article>)}{!data.serviceTeam.some((row) => !row.active) && <p className="text-[11px] text-olive-mute">暂无历史停用记录。</p>}</div></details>
  </CoachingPanel>;
}

function StaffRoleEditor({ person, onSaved }: { person: { id: number; name: string | null; role: string; serviceRoles: string[] }; onSaved: () => Promise<void> }) {
  const [roles, setRoles] = useState<CoachingServiceRole[]>(person.serviceRoles as CoachingServiceRole[]);
  const save = trpc.coaching.saveStaffRoles.useMutation({ onSuccess: onSaved });
  return <section className="rounded-xl bg-white p-3"><div className="flex flex-wrap items-center gap-2"><Users size={14} className="text-[#0C7064]" /><b className="min-w-0 flex-1 text-[12px] text-olive">{person.name}</b><button type="button" disabled={save.isPending} onClick={() => save.mutate({ userId: person.id, serviceRoles: roles })} className="min-h-8 rounded-lg border border-[#0C7064]/25 px-2.5 py-1 text-[10.5px] font-semibold text-[#0C7064] disabled:opacity-40">保存职能</button></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{COACHING_SERVICE_ROLES.map((role) => <label key={role.key} className="flex items-center gap-1.5 text-[11px] text-olive-soft"><input type="checkbox" checked={roles.includes(role.key)} disabled={(role.key === "admin" && person.role !== "admin") || (role.key === "admin" && person.role === "admin")} onChange={() => setRoles((current) => current.includes(role.key) ? current.filter((item) => item !== role.key) : [...current, role.key])} className="accent-[#0C7064] disabled:opacity-40" />{role.label}</label>)}</div>{save.error && <p role="alert" className="mt-2 text-[10.5px] text-red-700">{save.error.message}</p>}{save.isSuccess && <p className="mt-2 text-[10.5px] text-[#2F7A41]">职能清单已保存。</p>}</section>;
}
