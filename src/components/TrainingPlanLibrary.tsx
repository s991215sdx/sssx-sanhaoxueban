import { useMemo, useState } from "react";
import { ClipboardList, FileSignature, X, Loader2, Download } from "lucide-react";
import { THREE_TIER_PLANS, THREE_TIER_STYLE } from "@/data/training/threeTierPlans";
import AbilityPlanCard from "@/components/training/AbilityPlanCard";
import { METHOD_BY_ID, BOARD_LABEL, type TrainingMethod } from "@/data/training/methods";
import { trpc } from "@/providers/trpc";
import { downloadReport, esc } from "@/lib/reportDownload";

export type PrescriptionMethod = TrainingMethod & { ability?: string };

/**
 * 学习力陪跑训练方案库（三阶九能 · V51）。
 * 按三阶九能组织：每能列出典型问题 + 简要训练方案（一句话）；
 * 详细方案默认折叠，点击「简要方案」才展开。
 * V61：每个方法可勾选入「开方清单」，勾完开方推送给学员端，并可下载开方单。
 */
export default function TrainingPlanLibrary() {
  /* 开方清单：methodId → 方法（含来源能力） */
  const [selected, setSelected] = useState<Map<string, PrescriptionMethod>>(new Map());
  const [composerOpen, setComposerOpen] = useState(false);

  const toggleSelect = (m: TrainingMethod, ability: string) =>
    setSelected((cur) => {
      const next = new Map(cur);
      if (next.has(m.id)) next.delete(m.id);
      else next.set(m.id, { ...m, ability });
      return next;
    });
  const selectedIds = useMemo(() => new Set(selected.keys()), [selected]);

  return (
    <section className="paper-card p-5">
      <div className="flex items-center gap-2">
        <ClipboardList size={16} className="text-olive" />
        <h2 className="text-[16px] font-bold text-olive">学习力陪跑训练方案（三阶九能）</h2>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-olive-mute">
        对照学员的表现找到对应的问题，先看「简要方案」，感兴趣再点开看详细做法（步骤、频率、工具）。
        勾选方法可开成「伴学处方」推送给学员端。与学员报告中的训练方案口径一致。
      </p>

      <div className="mt-4 space-y-3.5">
        {(["乐学", "会学", "善学"] as const).map((tier) => {
          const st = THREE_TIER_STYLE[tier];
          const plans = THREE_TIER_PLANS.filter((p) => p.tier === tier);
          return (
            <div key={tier} className="rounded-xl border px-4 py-3.5" style={{ borderColor: st.border, background: st.bg }}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[14px] font-bold" style={{ color: st.color }}>
                  {st.label}
                </span>
                <span className="text-[11.5px] text-olive-mute">{st.sub}</span>
              </div>
              {/* V61：两列布局，详情展开后更宽更好读 */}
              {/* V62：一栏布局，卡片更宽更好读 */}
              <div className="mt-2.5 grid gap-3">
                {plans.map((p) => (
                  <AbilityPlanCard
                    key={p.ability}
                    tier={p.tier}
                    ability={p.ability}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 开方浮动条 */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-20 mt-4 flex items-center gap-3 rounded-2xl border border-lime/60 bg-olive px-4 py-3 text-cream shadow-lg">
          <FileSignature size={17} />
          <span className="text-[13.5px] font-semibold">已勾选 {selected.size} 个训练方法</span>
          <span className="hidden max-w-[40%] truncate text-[11.5px] text-cream/80 sm:inline">
            {[...selected.values()].map((m) => m.name).join("、")}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setSelected(new Map())}
              className="rounded-lg px-2.5 py-1.5 text-[12px] text-cream/80 hover:bg-white/10"
            >
              清空
            </button>
            <button
              onClick={() => setComposerOpen(true)}
              className="rounded-xl bg-cream px-4 py-2 text-[13px] font-bold text-olive hover:bg-lime-pale"
            >
              开方
            </button>
          </div>
        </div>
      )}

      {composerOpen && (
        <PrescriptionComposer methods={[...selected.values()]} onClose={() => setComposerOpen(false)} onDone={() => { setComposerOpen(false); setSelected(new Map()); }} />
      )}
    </section>
  );
}

/** 开方确认面板：选学员 + 自写补充方案 + 确认推送学员端 + 下载开方单。 */
function PrescriptionComposer({
  methods,
  onClose,
  onDone,
}: {
  methods: PrescriptionMethod[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: students } = trpc.coach.myStudents.useQuery();
  const [userId, setUserId] = useState<number | "">("");
  const [customText, setCustomText] = useState("");
  const create = trpc.coach.createPrescription.useMutation();

  const studentName = (students ?? []).find((s) => s.userId === Number(userId))?.name ?? "";

  const payload = methods.map((m) => ({ id: m.id, name: m.name, sub: m.sub, board: m.board, ability: m.ability }));

  const submit = () => {
    if (userId === "") return;
    create.mutate(
      { userId: Number(userId), methods: payload, customText: customText.trim() || undefined },
      { onSuccess: () => onDone() },
    );
  };

  const download = () => {
    const body = [
      `<h2>训练方法（${methods.length} 项）</h2>`,
      ...methods.map((m, i) => {
        const full = METHOD_BY_ID.get(m.id);
        return `<div class="box"><b>${i + 1}. ${esc(m.name)}（${esc(BOARD_LABEL[m.board])} · ${esc(m.sub)}）</b>
${full?.problems ? `<p><b>适用：</b>${esc(full.problems).replace(/\n/g, "<br/>")}</p>` : ""}
${full?.purpose ? `<p><b>目的：</b>${esc(full.purpose).replace(/\n/g, "<br/>")}</p>` : ""}
${full?.steps?.length ? `<ol>${full.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
${full?.schedule ? `<p><b>频率：</b>${esc(full.schedule)}</p>` : ""}
${full?.tool && full.tool !== "无" ? `<p><b>工具：</b>${esc(full.tool)}</p>` : ""}
</div>`;
      }),
      ...(customText.trim()
        ? [`<h2>伴学师补充方案</h2>`, `<div class="box"><p>${esc(customText.trim()).replace(/\n/g, "<br/>")}</p></div>`]
        : []),
    ].join("\n");
    downloadReport("伴学训练处方", body, studentName || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-olive/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-cream p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[17px] font-bold text-olive">
            <FileSignature size={18} /> 开方确认
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-olive-mute hover:bg-lime-pale hover:text-olive">
            <X size={18} />
          </button>
        </div>

        {/* 已选方法清单 */}
        <div className="mt-4">
          <div className="text-[12.5px] font-semibold text-olive">已勾选 {methods.length} 个方法</div>
          <div className="mt-2 space-y-1.5">
            {methods.map((m, i) => (
              <div key={m.id} className="rounded-lg border border-border bg-white/70 px-3 py-2 text-[12.5px] text-olive">
                <b>{i + 1}. {m.name}</b>
                <span className="ml-1.5 text-olive-mute">
                  {m.ability ? `【${m.ability}】· ` : ""}
                  {BOARD_LABEL[m.board]} · {m.sub}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 开给谁 */}
        <div className="mt-4">
          <div className="text-[12.5px] font-semibold text-olive">开给学员</div>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value === "" ? "" : Number(e.target.value))}
            className="mt-1.5 w-full rounded-xl border border-border bg-cream px-3.5 py-2.5 text-[13.5px] text-olive outline-none focus:border-lime"
          >
            <option value="">选择学员（推送到 TA 的学员端）</option>
            {(students ?? []).map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.name}{s.grade ? `（${s.grade}）` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* 自写补充方案 */}
        <div className="mt-4">
          <div className="text-[12.5px] font-semibold text-olive">补充方案（可选，自由书写）</div>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="除方案库方法外，给这位同学的其他安排/叮嘱……"
            className="mt-1.5 w-full rounded-xl border border-input bg-cream px-3.5 py-2.5 text-[13px] leading-relaxed text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25"
          />
        </div>

        {create.error && <p className="mt-2 text-[12.5px] text-terra">{create.error.message}</p>}

        <div className="mt-5 flex gap-2.5">
          <button
            onClick={download}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-cream px-4 py-3 text-[13.5px] font-semibold text-olive transition-colors hover:border-lime"
          >
            <Download size={15} /> 下载开方单
          </button>
          <button
            onClick={submit}
            disabled={create.isPending || userId === ""}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-olive py-3 text-[14.5px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
          >
            {create.isPending ? <Loader2 size={15} className="animate-spin" /> : <FileSignature size={15} />}
            {create.isPending ? "推送中…" : "确认开方，推送给学员端"}
          </button>
        </div>
      </div>
    </div>
  );
}
