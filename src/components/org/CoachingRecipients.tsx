import { useMemo } from "react";
import { KeyRound, ShieldCheck, UserX } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { CoachingDetail } from "./coachingTypes";
import { invalidateCoachingOperations } from "./coachingRefresh";

const GROUPS = [
  ["plan", "计划"],
  ["session_feedback", "课堂反馈"],
  ["deliverable", "录音／图片／文字附件"],
  ["monthly_report", "月度学习报告"],
  ["family_action", "家庭行动"],
] as const;
type ResourceType = typeof GROUPS[number][0];
type Grant = CoachingDetail["resourceRecipients"][number];

/** 逐份内容、逐位接收人的真实授权台账；不展示任何敏感正文。 */
export default function CoachingRecipients({ data }: { data: CoachingDetail }) {
  const utils = trpc.useUtils();
  const caseId = data.coachingCase.id;
  const names = useMemo(() => {
    const result = new Map<number, string>();
    for (const person of data.recipients) result.set(person.id, `${person.name ?? `账号 #${person.id}`} · ${person.label}`);
    for (const row of data.guardians) if (!result.has(row.grant.guardianUserId)) result.set(row.grant.guardianUserId, `${row.name ?? `账号 #${row.grant.guardianUserId}`} · ${row.grant.label}`);
    return result;
  }, [data.recipients, data.guardians]);
  const revoke = trpc.coaching.revokeResource.useMutation({ onSuccess: async () => {
    await Promise.all([utils.coaching.detail.invalidate({ caseId }), invalidateCoachingOperations(utils)]);
  } });
  const resourceName = (type: ResourceType, id: number) => {
    if (type === "plan") { const plan = data.plans.find((row) => row.id === id); return plan ? `${plan.title} V${plan.version}` : `计划 #${id}`; }
    if (type === "session_feedback") {
      const session = data.sessions.find((row) => row.participants.some((entry) => entry.participant.id === id));
      const participant = session?.participants.find((entry) => entry.participant.id === id)?.participant;
      return session ? `${new Date(session.startAt).toLocaleDateString("zh-CN")} 课堂反馈${participant?.feedbackVersion ? ` V${participant.feedbackVersion}` : ""}` : `课堂反馈 #${id}`;
    }
    if (type === "deliverable") { const file = data.deliverables.find((row) => row.id === id); return file ? `${file.kind === "audio" ? "录音" : file.kind === "image" ? "图片" : "文字反馈"} #${id}${file.version ? ` V${file.version}` : ""}${file.disposedAt ? "（媒体已销毁）" : ""}` : `附件 #${id}`; }
    if (type === "family_action") { const record = data.extendedRecords.find((row) => row.id === id); return record ? `${record.title} V${record.version}` : `家庭行动 #${id}`; }
    return `月度学习报告 #${id}`;
  };
  return <section className="rounded-2xl border border-border bg-white p-4 shadow-sm 2xl:col-span-2">
    <div className="flex flex-wrap items-start gap-3"><KeyRound size={18} className="mt-0.5 text-[#0C7064]" /><div className="min-w-0 flex-1"><h2 className="text-[15px] font-bold text-olive">逐份内容接收权限</h2><p className="mt-1 text-[11px] leading-relaxed text-olive-mute">“授权给某人”只开放这一份内容，不等于主档全家可见。撤销立即影响后续读取；历史授权与撤销时间继续留痕。</p></div><span className="rounded-full bg-mint-pale px-2.5 py-1 text-[10.5px] text-[#0C7064]">{data.resourceRecipients.filter((row) => row.active).length} 条有效</span></div>
    <div className="mt-4 grid items-start gap-3 lg:grid-cols-2">{GROUPS.map(([type, label]) => {
      const grants = data.resourceRecipients.filter((row) => row.resourceType === type);
      return <section key={type} className="rounded-xl border border-border bg-cream/30 p-3"><h3 className="flex items-center gap-1.5 text-[12px] font-bold text-olive"><ShieldCheck size={13} className="text-[#0C7064]" />{label}<span className="ml-auto text-[10px] font-normal text-olive-mute">{grants.length} 条历史</span></h3>
        <div className="mt-2 space-y-2">{grants.map((grant: Grant) => <article key={grant.id} className="rounded-lg bg-white p-2.5 text-[11px]"><div className="flex flex-wrap items-center gap-2"><b className="min-w-0 flex-1 break-words text-olive">{resourceName(type, grant.resourceId)}</b><span className={grant.active ? "text-[#2F7A41]" : "text-olive-mute"}>{grant.active ? "有效" : "已撤销"}</span></div><p className="mt-1 text-olive-soft">接收人：{names.get(grant.recipientUserId) ?? `账号 #${grant.recipientUserId}`}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-olive-mute"><span>授权：{new Date(grant.createdAt).toLocaleString("zh-CN")}</span>{grant.revokedAt && <span>撤销：{new Date(grant.revokedAt).toLocaleString("zh-CN")}</span>}{grant.active && <button type="button" disabled={revoke.isPending} onClick={() => revoke.mutate({ caseId, resourceType: type, resourceId: grant.resourceId, recipientUserId: grant.recipientUserId })} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-700 disabled:opacity-40"><UserX size={11} />撤销此人的此份权限</button>}</div></article>)}{!grants.length && <p className="rounded-lg border border-dashed border-border py-4 text-center text-[10.5px] text-olive-mute">尚无此类逐人授权。</p>}</div>
      </section>;
    })}</div>
    {revoke.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-[11px] text-red-700">{revoke.error.message}</p>}
    {revoke.isSuccess && <p className="mt-3 text-[11px] text-[#2F7A41]">指定接收权限已撤销并保留审计记录。</p>}
  </section>;
}
