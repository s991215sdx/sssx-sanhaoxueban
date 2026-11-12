import { useMemo, useState } from "react";
import { BookOpenCheck, Check, FileLock2, HeartHandshake, Save, UserRound, UsersRound } from "lucide-react";
import { isE3V37Result } from "@contracts/e3v37";
import { trpc } from "@/providers/trpc";
import type { CoachingDetail } from "./coachingTypes";
import { GROWTH_STAGES, VITALITY_TOWER, resolveGrowthStage, towerPosition } from "./knowledgeBase";

const KIND: Record<string, string> = { mbti: "MBTI", disc: "DISC", e3: "E3 学习力", multi5: "多元智能", mentalsdq: "心理健康 A 版", mentalpa: "心理健康 B 版", scl90: "SCL-90", mental: "心理健康通用版", subject4d: "学科四维", holland: "霍兰德", anchor: "职业锚", subject: "学科能力", e3parent: "家长认知", discparent: "家长 DISC", familystudent: "家庭关系·学生", familyparent: "家庭关系·家长" };
const DISC_ADVICE: Record<string, string> = {
  D: "直接说清目标，给两个可行选择，让孩子自己定；避免硬压和公开较劲。",
  I: "先让孩子充分表达，肯定他的想法，再一起收敛成一个具体行动。",
  S: "保持稳定节奏，变化提前说明；把任务拆小，持续陪伴而不是突然加码。",
  C: "说清标准、依据和准备时间，用事实和作品复盘，少用模糊评价。",
};
const input = "mt-1.5 w-full rounded-lg border border-border bg-cream px-3 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]";
const label = "block text-[11.5px] font-semibold text-olive";

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-white p-4 shadow-sm"><h3 className="flex items-center gap-1.5 text-[15px] font-bold text-olive">{icon}{title}</h3><div className="mt-3">{children}</div></section>;
}

export default function CoachingProfile({ data }: { data: CoachingDetail }) {
  const utils = trpc.useUtils();
  const { data: student, isLoading } = trpc.coach.studentDetail.useQuery({ userId: data.coachingCase.studentUserId });
  const profile = data.profile;
  const e3 = isE3V37Result(student?.assessments.e3) ? student.assessments.e3 : null;
  const growth = resolveGrowthStage({ birthDate: profile?.birthDate, grade: student?.profile?.grade });
  const tower = useMemo(() => e3 ? towerPosition(e3.abilities) : null, [e3]);
  const generatedAdvice = useMemo(() => {
    const disc = student?.profile?.disc?.trim().toUpperCase().charAt(0) ?? "";
    const weak = e3?.abilities.filter((ability) => ability.level !== "正常").sort((a, b) => a.score - b.score).slice(0, 3) ?? [];
    return [
      growth ? `成长阶段：${growth.stage.name}，重点支持「${growth.stage.quality}」。${growth.stage.repairAdvice}` : "成长阶段：请补全生日或年级后再参考阶段建议。",
      DISC_ADVICE[disc] ?? "DISC 尚未明确：先用开放式提问了解孩子的表达与决策习惯，不贴标签。",
      weak.length ? `E3 优先关注：${weak.map((item) => `${item.label} ${item.score.toFixed(1)} 分`).join("、")}。先选一项做小步行动，下一次复盘核对证据。` : "E3 暂无明确弱项：结合真人观察核对，不以一次测评替代持续了解。",
      "规则生成，须伴学师结合真人观察确认；不将类型或塔位当作心理诊断。",
    ].join("\n");
  }, [e3, growth, student?.profile?.disc]);
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? "");
  const [studentInfo, setStudentInfo] = useState(profile?.studentInfo ?? "");
  const [threeParty, setThreeParty] = useState(profile?.threeParty ?? "");
  const [parentProfile, setParentProfile] = useState(profile?.parentProfile ?? "");
  const [attention, setAttention] = useState(profile?.attention ?? "");
  const [commAdvice, setCommAdvice] = useState(profile?.commAdvice || generatedAdvice);
  const save = trpc.coaching.saveProfile.useMutation({ onSuccess: async () => { await utils.coaching.detail.invalidate({ caseId: data.coachingCase.id }); } });
  const grow = data.planning.growProfiles[0];
  const towerLabels = [
    { key: "humanistic" as const, title: "需要层", values: VITALITY_TOWER.humanistic },
    { key: "psychoanalytic" as const, title: "自我感受", values: VITALITY_TOWER.psychoanalytic },
    { key: "behavioral" as const, title: "行动发展", values: VITALITY_TOWER.behavioral },
  ];
  return <div className="space-y-4">
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11.5px] leading-relaxed text-amber-900"><FileLock2 size={15} className="mr-1.5 inline" />本页为陪跑师内部画像。三方信息、家庭特点与沟通注意事项仅供服务使用，不自动推送家长；不在这里录入或展示心理原始作答。</div>
    <div className="grid items-start gap-4 2xl:grid-cols-2">
      <div className="space-y-4">
        <Panel title="孩子基本信息" icon={<UserRound size={16} />}>
          <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-3">
            {[ ["姓名", student?.profile?.name ?? "读取中"], ["年级", student?.profile?.grade || "待补全"], ["学校", student?.profile?.school || "待补全"], ["目标学校", student?.profile?.targetSchool || grow?.targetSchool || "待明确"], ["每日可用", `${student?.profile?.dailyMinutes ?? "—"} 分钟`], ["服务周期", `${data.coachingCase.serviceStart}～${data.coachingCase.serviceEnd}`] ].map(([name, value]) => <div key={name} className="rounded-lg bg-cream/55 p-2.5"><span className="block text-[10px] text-olive-mute">{name}</span><b className="mt-1 block break-words font-semibold text-olive">{value}</b></div>)}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]"><label className={label}>出生日期<input aria-label="出生日期" type="date" value={birthDate} max={new Date().toLocaleDateString("en-CA")} onChange={(event) => setBirthDate(event.target.value)} className={input} /></label><label className={label}>孩子信息补充<textarea aria-label="孩子信息补充" rows={3} value={studentInfo} onChange={(event) => setStudentInfo(event.target.value)} placeholder="兴趣、日常节奏、重要经历、已确认的支持资源；只记与陪跑相关的必要信息。" className={input} /></label></div>
        </Panel>
        <Panel title="三方信息收集表" icon={<UsersRound size={16} />}>
          <p className="mb-2 text-[11px] leading-relaxed text-olive-mute">V1 采用可编辑文本归档，可分别记录学生、家长、伴学师访谈；尚未复刻原 Excel 的逐格表单。请记录已核实内容，未访谈的项目不要代填。</p>
          <textarea aria-label="三方信息收集表" rows={9} value={threeParty} onChange={(event) => setThreeParty(event.target.value)} placeholder={"学生：喜欢与困难、同伴关系、学习目标\n家长：家庭节奏、主要期待、可配合方式\n伴学师：真人观察、已核实事实、待进一步了解事项"} className={input} />
        </Panel>
        <Panel title="家庭期望与特点" icon={<HeartHandshake size={16} />}>
          <div className="rounded-lg bg-mint-pale/35 p-3 text-[11.5px] leading-relaxed text-olive-soft"><b>父母期望（GROW 已记录）：</b>{grow?.parentExpectation || "尚未记录，请先在规划页完成家庭访谈。"}</div>
          <label className={`${label} mt-3`}>父母特点与家庭配合观察<textarea aria-label="父母特点与家庭配合观察" rows={4} value={parentProfile} onChange={(event) => setParentProfile(event.target.value)} placeholder="沟通偏好、可投入时间、双方一致与分歧处；不作人格诊断。" className={input} /></label>
        </Panel>
      </div>
      <div className="space-y-4">
        <Panel title="测评数据及特点概要" icon={<BookOpenCheck size={16} />}>
          {isLoading ? <p className="text-[12px] text-olive-mute">正在读取测评概要…</p> : <>
            <div className="flex flex-wrap gap-2">{data.results.map((result) => <span key={result.id} className="rounded-full bg-mint-pale px-2.5 py-1 text-[10.5px] text-[#0C7064]">{KIND[result.kind] ?? result.kind} · {new Date(result.createdAt).toLocaleDateString("zh-CN")}</span>)}{!data.results.length && <span className="text-[11.5px] text-olive-mute">暂无可查看的测评报告。</span>}</div>
            <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-cream/55 p-3 text-[12px]"><span className="text-olive-mute">DISC</span><b className="ml-2 text-olive">{student?.profile?.disc || "未测"}</b></div><div className="rounded-lg bg-cream/55 p-3 text-[12px]"><span className="text-olive-mute">MBTI</span><b className="ml-2 text-olive">{student?.profile?.mbti || "未测"}</b></div></div>
            {e3 ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[420px] border-collapse text-[11.5px]"><thead><tr className="bg-cream text-left text-olive"><th className="rounded-l-lg px-3 py-2">维度</th><th className="px-3 py-2">能力项</th><th className="px-3 py-2">分数</th><th className="rounded-r-lg px-3 py-2">状态</th></tr></thead><tbody>{e3.abilities.map((ability) => <tr key={ability.key} className="border-b border-border/60"><td className="px-3 py-2 text-olive-mute">{ability.system === "乐学" ? "心" : ability.system === "会学" ? "脑" : "行"}</td><td className="px-3 py-2 text-olive">{ability.label}</td><td className="px-3 py-2 font-semibold text-olive">{ability.score.toFixed(1)}</td><td className={`px-3 py-2 ${ability.level === "卡点" ? "text-red-700" : ability.level === "待提升" ? "text-amber-700" : "text-green-700"}`}>{ability.level === "卡点" ? "问题明显" : ability.level === "待提升" ? "有待关注" : "健康"}</td></tr>)}</tbody></table></div> : <p className="mt-3 rounded-lg bg-cream/50 p-3 text-[11px] text-olive-mute">暂无 V3.7 E3 结果；不生成塔位或分数建议，请先测评或采用真人观察。</p>}
          </>}
        </Panel>
        <Panel title="生命教育成长地图" icon={<UserRound size={16} />}>
          {growth ? <><div className="rounded-xl bg-mint-pale/45 p-3"><div className="flex flex-wrap items-center gap-2"><b className="text-[15px] text-[#0C7064]">{growth.stage.name}</b><span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-olive-soft">{growth.source === "birthday" ? `按生日 · ${growth.age} 周岁` : `按年级估算 · 约 ${growth.age} 岁`}</span></div><p className="mt-2 text-[11.5px] leading-relaxed text-olive-soft"><b>本阶段重点：</b>{growth.stage.psychTask}</p><p className="mt-1 text-[11.5px] leading-relaxed text-olive-soft"><b>陪跑提醒：</b>{growth.stage.repairAdvice}</p></div><div className="mt-3 grid grid-cols-3 gap-1.5">{GROWTH_STAGES.map((stage) => <div key={stage.key} className={`rounded-lg border px-2 py-2 text-[10px] ${stage.key === growth.stage.key ? "border-[#0C7064] bg-mint-pale font-bold text-[#0C7064]" : "border-border bg-cream/40 text-olive-mute"}`}>{stage.minAge}–{stage.maxAge} 岁<br /><span className="mt-0.5 block">{stage.name}</span></div>)}</div></> : <p className="text-[12px] text-olive-mute">请补全有效生日或可识别的年级后，再显示对应阶段；当前不猜测。</p>}
        </Panel>
        <Panel title="生命力之塔 · 规则参考" icon={<BookOpenCheck size={16} />}>
          <p className="mb-2 text-[10.5px] text-olive-mute">主线：{VITALITY_TOWER.mainline.join(" → ")}。塔位只用于教研讨论，不是心理诊断，也不能替代后续观察。</p>
          {tower ? <div className="space-y-2">{towerLabels.map((row) => { const position = tower[row.key]; return <div key={row.key} className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2 rounded-lg bg-cream/45 p-2.5"><b className="text-[11px] text-olive">{row.title}</b><span className="text-[11.5px] text-olive-soft">{position === null ? "对应 E3 数据不足，暂不定位" : `参考位置：${row.values[Math.min(position, row.values.length) - 1]}`}</span></div>; })}</div> : <p className="rounded-lg bg-cream/50 p-3 text-[11px] text-olive-mute">无 V3.7 E3 数据，不显示默认塔位。</p>}
        </Panel>
      </div>
    </div>
    <div className="grid items-start gap-4 2xl:grid-cols-2">
      <Panel title="现状、目标与陪跑沟通建议" icon={<HeartHandshake size={16} />}>
        <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-cream/50 p-3 text-[11.5px] leading-relaxed text-olive-soft"><b className="block text-olive">明确目标</b>{grow?.studentGoal || data.coachingCase.goal}</div><div className="rounded-lg bg-cream/50 p-3 text-[11.5px] leading-relaxed text-olive-soft"><b className="block text-olive">评估现状</b>{grow?.currentSituation || data.coachingCase.currentSituation}</div></div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><b className="text-[12px] text-olive">陪跑沟通建议</b><button type="button" className="rounded-lg border border-[#0C7064]/25 px-2 py-1 text-[10.5px] text-[#0C7064]" onClick={() => setCommAdvice(generatedAdvice)}>按阶段 × DISC × E3 重新生成草稿</button></div>
        <textarea aria-label="陪跑沟通建议" rows={8} value={commAdvice} onChange={(event) => setCommAdvice(event.target.value)} className={input} />
        <p className="mt-1 text-[10.5px] text-olive-mute">规则生成内容须由伴学师结合真人观察修订后保存，不自动成为家庭反馈。</p>
      </Panel>
      <Panel title="注意事项与复盘联动" icon={<FileLock2 size={16} />}>
        <label className={label}>服务注意事项<textarea aria-label="服务注意事项" rows={6} value={attention} onChange={(event) => setAttention(event.target.value)} placeholder="已确认的沟通边界、家庭配合限制、需持续观察事项；心理风险请另走异常与专业转介流程。" className={input} /></label>
        <div className="mt-3 rounded-xl bg-mint-pale/35 p-3 text-[11.5px] leading-relaxed text-olive-soft"><Check size={14} className="mr-1 inline text-[#0C7064]" />成长页会结合最近复盘、近 7 天日检验、待验收任务和这里的注意事项生成下一步建议。建议只填入复盘草稿，仍须伴学师核对并保存。</div>
      </Panel>
    </div>
    <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-[#0C7064]/20 bg-white/95 p-3 shadow-lg backdrop-blur"><span className="min-w-0 flex-1 text-[11px] text-olive-mute">保存后仅写入本机构当前主档；所有内部字段不会自动推送。</span><button type="button" disabled={save.isPending} onClick={() => save.mutate({ caseId: data.coachingCase.id, birthDate: birthDate || null, studentInfo, threeParty, parentProfile, attention, commAdvice })} className="min-h-10 rounded-xl bg-[#0C7064] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40"><Save size={14} className="mr-1 inline" />{save.isPending ? "保存中…" : "保存内部画像"}</button></div>
    {save.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-[12px] text-red-700">{save.error.message}</p>}{save.isSuccess && <p role="status" className="text-[12px] text-green-700">内部画像已保存。</p>}
  </div>;
}
