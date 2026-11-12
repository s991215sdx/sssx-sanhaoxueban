import { useMemo, useState } from "react";
import { Check, FileLock2, Save } from "lucide-react";
import { isE3V37Result } from "@contracts/e3v37";
import { trpc } from "@/providers/trpc";
import type { CoachingDetail } from "./coachingTypes";
import { GROWTH_STAGES, VITALITY_TOWER, resolveGrowthStage, towerPosition } from "./knowledgeBase";
import { CoachingPageHeading, CoachingPanel, V4_PRIMARY } from "./CoachingV4";

const KIND: Record<string, string> = { mbti: "MBTI", disc: "DISC", e3: "E3 学习力", multi5: "多元智能", mentalsdq: "心理健康 A 版", mentalpa: "心理健康 B 版", scl90: "SCL-90", mental: "心理健康通用版", subject4d: "学科四维", holland: "霍兰德", anchor: "职业锚", subject: "学科能力", e3parent: "家长认知", discparent: "家长 DISC", familystudent: "家庭关系·学生", familyparent: "家庭关系·家长" };
const DISC_ADVICE: Record<string, string> = {
  D: "直接说清目标，给两个可行选择，让孩子自己定；避免硬压和公开较劲。",
  I: "先让孩子充分表达，肯定他的想法，再一起收敛成一个具体行动。",
  S: "保持稳定节奏，变化提前说明；把任务拆小，持续陪伴而不是突然加码。",
  C: "说清标准、依据和准备时间，用事实和作品复盘，少用模糊评价。",
};
const input = "mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064] focus-visible:ring-2 focus-visible:ring-[#0C7064]/20";
const label = "block text-[11.5px] font-semibold text-olive";

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
  const latestReview = data.reviews[0];
  const towerLabels = [
    { key: "humanistic" as const, title: "人本 · 五驱动", values: VITALITY_TOWER.humanistic },
    { key: "psychoanalytic" as const, title: "精神分析 · 关系线", values: VITALITY_TOWER.psychoanalytic },
    { key: "behavioral" as const, title: "行为主义 · 自我线", values: VITALITY_TOWER.behavioral },
  ];
  return <div className="space-y-4">
    <CoachingPageHeading title={`${student?.profile?.name ?? "学员"} · 学员画像`} description="伴学师内部视图 ｜ 孩子信息表内容仅伴学师可见，不进家长反馈与月报 ｜ 每次复盘结合本画像生成下一步建议" />
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11.5px] leading-relaxed text-amber-900"><FileLock2 size={15} className="mr-1.5 inline" />三方信息、家庭特点与沟通注意事项仅供服务使用，不自动推送家长；不在这里录入或展示心理原始作答。</div>

    <div className="grid items-start gap-4 xl:grid-cols-3">
      <CoachingPanel title="基本信息" subtitle="真实学员档案">
        <div className="space-y-1.5 text-[12px]"><Info label="姓名" value={student?.profile?.name ?? "读取中"} /><Info label="出生日期" value={birthDate ? `${birthDate}${growth?.source === "birthday" ? `（${growth.age} 周岁）` : ""}` : "待补全"} /><Info label="学校／年级" value={`${student?.profile?.school || "学校待补全"} · ${student?.profile?.grade || "年级待补全"}`} /><Info label="目标学校" value={student?.profile?.targetSchool || grow?.targetSchool || "待明确"} /><Info label="服务周期" value={`${data.coachingCase.serviceStart}～${data.coachingCase.serviceEnd}`} /><Info label="每日可用" value={student?.profile?.dailyMinutes != null ? `${student.profile.dailyMinutes} 分钟` : "待补全"} /></div>
        <label className={`${label} mt-3`}>出生日期<input aria-label="出生日期" type="date" value={birthDate} max={new Date().toLocaleDateString("en-CA")} onChange={(event) => setBirthDate(event.target.value)} className={input} /></label>
        <label className={`${label} mt-3`}>孩子信息补充<textarea aria-label="孩子信息补充" rows={4} value={studentInfo} onChange={(event) => setStudentInfo(event.target.value)} placeholder="兴趣、日常节奏、重要经历、已确认的支持资源；只记必要信息。" className={input} /></label>
      </CoachingPanel>

      <CoachingPanel title="三方信息收集表" subtitle="学生／家长／伴学师访谈归档">
        <p className="mb-2 rounded-lg bg-cream/60 p-2.5 text-[10.5px] leading-relaxed text-olive-mute">当前为可编辑文本归档，尚未复刻原 Excel 的逐格表单。请记录已核实内容，未访谈的项目不要代填。</p>
        <textarea aria-label="三方信息收集表" rows={12} value={threeParty} onChange={(event) => setThreeParty(event.target.value)} placeholder={"学生：喜欢与困难、同伴关系、学习目标\n家长：家庭节奏、主要期待、可配合方式\n伴学师：真人观察、已核实事实、待进一步了解事项"} className={input} />
      </CoachingPanel>

      <CoachingPanel title="测评数据与特点概要" subtitle="自动汇总 · 原始答案不展示">
        {isLoading ? <p className="text-[12px] text-olive-mute">正在读取测评概要…</p> : <>
          <div className="flex flex-wrap gap-1.5">{data.results.map((result) => <span key={result.id} className="rounded-full bg-[#E5EFE8] px-2.5 py-1 text-[10px] text-[#0C7064]">{KIND[result.kind] ?? result.kind} · {new Date(result.createdAt).toLocaleDateString("zh-CN")}</span>)}{!data.results.length && <span className="text-[11.5px] text-olive-mute">暂无可查看的测评报告。</span>}</div>
          <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-cream/55 p-3 text-[12px]"><span className="text-olive-mute">DISC</span><b className="ml-2 text-olive">{student?.profile?.disc || "未测"}</b></div><div className="rounded-lg bg-cream/55 p-3 text-[12px]"><span className="text-olive-mute">MBTI</span><b className="ml-2 text-olive">{student?.profile?.mbti || "未测"}</b></div></div>
          {e3 ? <><div className="mt-3 flex flex-wrap gap-1.5">{e3.abilities.filter((ability) => ability.level !== "正常").map((ability) => <span key={ability.key} className={`rounded-full px-2 py-1 text-[10px] ${ability.level === "卡点" ? "bg-[#F9E4E1] text-[#A82524]" : "bg-[#FAF0CC] text-[#8A6500]"}`}>{ability.label} {ability.score.toFixed(1)} · {ability.level === "卡点" ? "问题明显" : "有待关注"}</span>)}</div><details className="mt-3 rounded-lg bg-cream/40 p-2.5"><summary className="cursor-pointer text-[11px] font-semibold text-olive">查看 E3 九能分明细</summary><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[340px] border-collapse text-[10.5px]"><thead><tr className="text-left text-olive-mute"><th className="py-1.5">能力项</th><th className="py-1.5">分数</th><th className="py-1.5">状态</th></tr></thead><tbody>{e3.abilities.map((ability) => <tr key={ability.key} className="border-t border-border/60"><td className="py-1.5 text-olive">{ability.label}</td><td className="py-1.5 font-semibold text-olive">{ability.score.toFixed(1)}</td><td className={`py-1.5 ${ability.level === "卡点" ? "text-red-700" : ability.level === "待提升" ? "text-amber-700" : "text-green-700"}`}>{ability.level === "卡点" ? "问题明显" : ability.level === "待提升" ? "有待关注" : "健康"}</td></tr>)}</tbody></table></div></details></> : <p className="mt-3 rounded-lg bg-cream/50 p-3 text-[11px] text-olive-mute">暂无 V3.7 E3 结果；不生成塔位或分数建议，请先测评或采用真人观察。</p>}
        </>}
      </CoachingPanel>
    </div>

    <CoachingPanel title="生命教育成长地图 · 当前周期" subtitle="我愿意 · 九阶段" action={growth ? <span className="rounded-full bg-[#E5EFE8] px-2.5 py-1 text-[10px] font-semibold text-[#0C7064]">当前：{growth.stage.minAge}–{growth.stage.maxAge} 岁 · {growth.stage.name} · {growth.stage.quality}</span> : undefined}>
      {growth ? <><div className="grid grid-cols-3 gap-1 text-center text-[9.5px] md:grid-cols-9">{GROWTH_STAGES.map((stage) => <div key={stage.key} className={`rounded-lg p-2 ${stage.key === growth.stage.key ? "border-2 border-[#0C7064] bg-[#E5EFE8] text-[#0C7064]" : "bg-cream text-olive-soft"}`}><b className="block text-[11px]">{stage.key === growth.stage.key ? "▶ " : ""}{stage.minAge}–{stage.maxAge} 岁</b>{stage.name}<div className="mt-0.5 text-olive-mute">{stage.quality}</div></div>)}</div><div className="mt-3 grid gap-3 md:grid-cols-3 text-[11.5px]"><div className="rounded-xl bg-cream p-3"><b className="text-[12px] text-olive">本阶段心理任务</b><p className="mt-1 leading-relaxed text-olive-soft">{growth.stage.psychTask}</p></div><div className="rounded-xl bg-cream p-3"><b className="text-[12px] text-olive">常见防御与风险</b><p className="mt-1 leading-relaxed text-olive-soft">{growth.stage.defenseRisk}</p></div><div className="rounded-xl bg-[#E5EFE8] p-3"><b className="text-[12px] text-[#0C7064]">伴学修复建议</b><p className="mt-1 leading-relaxed text-olive-soft">{growth.stage.repairAdvice}</p></div></div><p className="mt-2 text-[10.5px] text-olive-mute">{growth.source === "birthday" ? `按生日计算 · ${growth.age} 周岁` : `生日未补全，按年级估算 · 约 ${growth.age} 岁`}</p></> : <p className="rounded-lg border border-dashed border-border p-4 text-[12px] text-olive-mute">请补全有效生日或可识别的年级后，再显示对应阶段；当前不猜测。</p>}
    </CoachingPanel>

    <div className="grid items-start gap-4 xl:grid-cols-3">
      <CoachingPanel title="生命力之塔 · 规则参考" subtitle="三面一心 · 每月教研复核">
        <div className="space-y-2">{towerLabels.map((row) => { const position = tower?.[row.key] ?? null; return <div key={row.key} className="rounded-lg bg-cream/60 p-2.5"><b className="text-[11.5px] text-olive">{row.title}</b>{position === null ? <p className="mt-1 text-[11px] text-olive-mute">对应 E3 数据不足，暂不定位</p> : <div className="mt-1 flex flex-wrap items-center gap-1 text-[10.5px] leading-relaxed">{row.values.map((value, index) => <span key={value} className={index + 1 === position ? "rounded bg-[#E5EFE8] px-1.5 py-0.5 font-bold text-[#0C7064]" : "text-olive-soft"}>{index + 1 === position ? "▶ " : ""}{value}</span>)}</div>}</div>; })}</div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-olive-mute">主线：{VITALITY_TOWER.mainline.join(" → ")}。塔位只用于教研讨论，不是心理诊断，也不能替代后续观察。</p>
      </CoachingPanel>

      <CoachingPanel title="父母的期望与特点" subtitle="家庭访谈与陪跑观察">
        <div className="rounded-lg bg-[#E5EFE8]/45 p-3 text-[11.5px] leading-relaxed text-olive-soft"><b className="text-olive">主要期望：</b>{grow?.parentExpectation || "尚未记录，请先在规划页完成家庭访谈。"}</div>
        <label className={`${label} mt-3`}>父母特点与家庭配合观察<textarea aria-label="父母特点与家庭配合观察" rows={7} value={parentProfile} onChange={(event) => setParentProfile(event.target.value)} placeholder="沟通偏好、最在意的事、可投入时间、双方一致与分歧处；不作人格诊断。" className={input} /></label>
      </CoachingPanel>

      <CoachingPanel title="陪跑沟通建议" subtitle={`${student?.profile?.disc || "DISC 待明确"} × ${growth?.stage.name ?? "阶段待明确"} × 测评`}>
        <button type="button" className="min-h-9 rounded-lg border border-[#0C7064]/25 px-2.5 py-1.5 text-[10.5px] font-semibold text-[#0C7064]" onClick={() => setCommAdvice(generatedAdvice)}>按阶段 × DISC × E3 重新生成草稿</button>
        <textarea aria-label="陪跑沟通建议" rows={10} value={commAdvice} onChange={(event) => setCommAdvice(event.target.value)} className={input} />
        <p className="mt-1 text-[10.5px] leading-relaxed text-olive-mute">规则生成内容须由伴学师结合真人观察修订后保存，主教／督学共用同一口径，不自动成为家庭反馈。</p>
      </CoachingPanel>
    </div>

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <CoachingPanel title="现状及目标（联动 GROW 总览）" subtitle="注意事项只作内部陪跑提醒">
        <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-cream/60 p-3 text-[11.5px] leading-relaxed text-olive-soft"><b className="mb-1 block text-olive">明确目标</b>{grow?.studentGoal || data.coachingCase.goal || "尚未记录"}</div><div className="rounded-lg bg-cream/60 p-3 text-[11.5px] leading-relaxed text-olive-soft"><b className="mb-1 block text-olive">评估现状</b>{grow?.currentSituation || data.coachingCase.currentSituation || "尚未记录"}</div></div>
        <label className={`${label} mt-3`}>服务注意事项<textarea aria-label="服务注意事项" rows={5} value={attention} onChange={(event) => setAttention(event.target.value)} placeholder="已确认的沟通边界、家庭配合限制、需持续观察事项；心理风险请另走异常与专业转介流程。" className={input} /></label>
      </CoachingPanel>
      <CoachingPanel title="复盘联动" subtitle="历史复盘 × 画像 × 执行证据">
        <p className="text-[11.5px] leading-relaxed text-olive-soft">成长页会结合最近复盘、近 7 天日检验、待验收任务和这里的注意事项生成下一步建议。建议只填入复盘草稿，仍须伴学师核对并保存。</p>
        <div className="mt-3 rounded-lg bg-[#E5EFE8]/50 p-3 text-[11px] leading-relaxed text-olive-soft">{latestReview ? <><b className="text-[#0C7064]">最近复盘 {latestReview.periodKey} V{latestReview.version}</b><p className="mt-1 whitespace-pre-wrap">{latestReview.nextActions}</p></> : "尚无复盘记录，不会生成示例结论。"}</div>
        <p className="mt-2 text-[10.5px] text-[#0C7064]"><Check size={13} className="mr-1 inline" />只使用当前学员真实数据。</p>
      </CoachingPanel>
    </div>

    <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-[#0C7064]/20 bg-white/95 p-3 shadow-lg backdrop-blur"><span className="min-w-0 flex-1 text-[11px] text-olive-mute">保存后仅写入本机构当前主档；所有内部字段不会自动推送。</span><button type="button" disabled={save.isPending} onClick={() => save.mutate({ caseId: data.coachingCase.id, birthDate: birthDate || null, studentInfo, threeParty, parentProfile, attention, commAdvice })} className={V4_PRIMARY}><Save size={14} />{save.isPending ? "保存中…" : "保存内部画像"}</button></div>
    {save.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-[12px] text-red-700">{save.error.message}</p>}{save.isSuccess && <p role="status" className="text-[12px] text-green-700">内部画像已保存。</p>}
  </div>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 border-b border-[#F0EDE0] pb-1.5 last:border-0"><span className="shrink-0 text-olive-mute">{label}</span><span className="break-words text-right font-medium text-olive">{value}</span></div>;
}
