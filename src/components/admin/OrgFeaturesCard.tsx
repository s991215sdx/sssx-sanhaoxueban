import { trpc } from "@/providers/trpc";
import { BadgeCheck, Lock } from "lucide-react";
import { ORG_EDITIONS, ORG_SERVICES } from "@contracts/edition";
import { INVITE_ASSESS_KINDS } from "@contracts/invite";

/**
 * v227：机构「版本与功能」只读卡片——机构管理员可见，修改权在平台超管（总系统）。
 * 数据来自 school.context（职员侧下发 edition/services/assessKinds）。
 */
export default function OrgFeaturesCard() {
  const { data: ctx } = trpc.school.context.useQuery();
  if (!ctx || ctx.role === "user" || !ctx.edition) return null;
  const editionLabel = ORG_EDITIONS.find((e) => e.key === ctx.edition)?.label ?? ctx.edition;
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
    </div>
  );
}
