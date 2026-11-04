import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { BadgeCheck, BookOpen, ChevronDown, Lock } from "lucide-react";
import { ORG_EDITIONS, ORG_SERVICES, type OrgServiceKey } from "@contracts/edition";
import { INVITE_ASSESS_KINDS } from "@contracts/invite";

/**
 * v227：机构「版本与功能」只读卡片——机构管理员可见，修改权在平台超管（总系统）。
 * 数据来自 school.context（职员侧下发 edition/services/assessKinds）。
 * v246：新增「功能说明书」区块，逐项说明各功能模块的用途与要点；
 * 在 SchoolConsole 的「版本与功能」独立页默认展开，机构后台首页默认折叠。
 */

/** 功能说明书：每个模块的一句话定位 + 功能要点。 */
const SERVICE_MANUAL: Record<OrgServiceKey, { summary: string; points: string[] }> = {
  assessCenter: {
    summary: "机构的测评中枢：把测评按组合/单项组织成目录，定向推送给学生，并跟踪完成情况。",
    points: [
      "测评目录：按「测评组合 + 单项测评」组织，可勾选任意组合或单项进行推送",
      "批量推送：按班级、年级或指定学生组选推送，也可生成注册二维码，学生扫码注册后自动进入测评",
      "进度看板：实时查看每位学生的完成进度，对未完成学生一键催办",
      "预警中心：心理状态类测评出现异常结果时自动标记预警，便于指导老师及时介入",
    ],
  },
  xuanke: {
    summary: "面向新高考 3+1+2 的选科全流程：测、填、管、出报告。",
    points: [
      "智慧测评套件：学科兴趣、学科能力、学科成绩、选科决策等测评，多维度定位选科方向",
      "选科意向：学生在线填报选科意向，老师可查看、统计与跟进",
      "月考成绩：录入各学科月考成绩，作为选科参考与报告数据源",
      "选科及升学规划报告：基于测评与成绩自动生成，含选科推荐与升学路径分析",
    ],
  },
  intention: {
    summary: "校级选科数据统计与「一生一册」成长档案。",
    points: [
      "选科意向分析：各选科组合的填报分布、学科热度一目了然",
      "选科统计：面向教务处/年级的选科统计报表",
      "一生一册成长档案：汇聚学生成绩曲线（分数+排名）、指导记录、测评与档案时间轴，形成完整成长轨迹",
    ],
  },
  library: {
    summary: "校本学习资料库。",
    points: ["按学科、年级、类型浏览与检索学习资料", "资料由机构统一维护，学生端随开随用"],
  },
  aiCoach: {
    summary: "学生的 AI 伴学空间。",
    points: ["AI 对话陪练：围绕知识点进行问答式练习", "心情树洞：学生匿名倾诉，释放情绪压力"],
  },
  reportAssign: {
    summary: "学员报告的查看权限开关，用于保护学生隐私。",
    points: [
      "开启后：伴学师/指导老师须由管理员逐个分配学员，才能查看对应学员的测评报告",
      "关闭后：教职人员默认可查看本机构学员的报告",
    ],
  },
};

export default function OrgFeaturesCard({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { data: ctx } = trpc.school.context.useQuery();
  const [open, setOpen] = useState(defaultOpen);
  if (!ctx || ctx.role === "user" || !ctx.edition) return null;
  const edition = ORG_EDITIONS.find((e) => e.key === ctx.edition);
  const editionLabel = edition?.label ?? ctx.edition;
  const assessKinds = ctx.assessKinds;
  const assessText = !assessKinds || !assessKinds.length || assessKinds.includes("all")
    ? "全部测评"
    : assessKinds
        .map((k) => INVITE_ASSESS_KINDS.find((x) => x.key === k)?.label ?? k)
        .join("、");

  return (
    <div className="paper-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-pale text-brand">
          <BadgeCheck size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-bold text-olive">版本与功能</span>
            <span className="rounded-full bg-butter-pale px-2 py-0.5 text-[11px] font-semibold text-olive">{editionLabel}</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-olive-mute">
              <Lock size={11} /> 由平台超管统一管理，如需开通/关闭请联系平台方
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ORG_SERVICES.map((s) => {
              const on = ctx.services?.[s.key] ?? true;
              return (
                <span
                  key={s.key}
                  title={s.desc}
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    on ? "bg-lime-pale text-olive" : "bg-[#EFECE6] text-olive-mute line-through"
                  }`}
                >
                  {s.label}
                </span>
              );
            })}
            <span className="rounded-full bg-lime-pale px-2 py-0.5 text-[11px] text-olive">开放测评：{assessText}</span>
          </div>
        </div>
      </div>

      {/* v246 功能说明书 */}
      <div className="mt-4 border-t border-[#1E3530]/10 pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-lime-pale/50"
        >
          <span className="flex items-center gap-2 text-[13px] font-bold text-olive">
            <BookOpen size={15} className="text-brand" />
            功能说明书
            <span className="text-[11px] font-normal text-olive-mute">各功能模块的用途与使用要点</span>
          </span>
          <ChevronDown size={15} className={`text-olive-mute transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="mt-3 space-y-3">
            {/* 版本说明 */}
            <div className="rounded-xl bg-cream-deep p-3">
              <div className="text-[12px] font-bold text-olive">版本说明</div>
              <div className="mt-1.5 space-y-1.5">
                {ORG_EDITIONS.map((e) => (
                  <div key={e.key} className="flex gap-2 text-[12px] leading-relaxed">
                    <span
                      className={`mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                        e.key === ctx.edition ? "bg-brand text-white" : "bg-[#EFECE6] text-olive-mute"
                      }`}
                    >
                      {e.label}
                    </span>
                    <span className="text-olive-soft">{e.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 模块说明 */}
            {ORG_SERVICES.map((s) => {
              const on = ctx.services?.[s.key] ?? true;
              const manual = SERVICE_MANUAL[s.key];
              return (
                <div key={s.key} className="rounded-xl border border-[#1E3530]/10 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${on ? "bg-lime" : "bg-[#C9CFC9]"}`} />
                    <span className="text-[13px] font-bold text-olive">{s.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                        on ? "bg-lime-pale text-olive" : "bg-[#EFECE6] text-olive-mute"
                      }`}
                    >
                      {on ? "已开通" : "未开通"}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-olive-soft">{manual.summary}</p>
                  <ul className="mt-1.5 space-y-1">
                    {manual.points.map((pt) => (
                      <li key={pt} className="flex gap-1.5 text-[12px] leading-relaxed text-olive-soft">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand/60" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                  {s.key === "assessCenter" && (
                    <p className="mt-1.5 text-[11.5px] text-olive-mute">本机构开放测评：{assessText}</p>
                  )}
                </div>
              );
            })}

            <p className="px-1 text-[11px] text-olive-mute">说明：功能开通/关闭由平台超管在「总系统」统一配置；本说明书随系统版本更新。</p>
          </div>
        )}
      </div>
    </div>
  );
}
