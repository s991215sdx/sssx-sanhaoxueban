import { useState } from "react";
import { FileSignature, ChevronDown, ChevronUp } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { METHOD_BY_ID, BOARD_LABEL } from "@/data/training/methods";

/** V61：伴学处方卡（学员端首页）：伴学师开方推送的训练方法 + 补充方案，点开看详细做法。 */
export default function PrescriptionsCard() {
  const { data: rxList } = trpc.dashboard.myPrescriptions.useQuery();
  const [openId, setOpenId] = useState<number | null>(null);
  const [openMethod, setOpenMethod] = useState<string | null>(null);
  if (!rxList || rxList.length === 0) return null;

  return (
    <section className="paper-card accent-l border-lime p-5">
      <div className="flex items-center gap-2">
        <FileSignature size={16} className="text-olive" />
        <h2 className="text-[16px] font-bold text-olive">伴学处方</h2>
        <span className="rounded-full bg-lime-pale px-2 py-px text-[10.5px] font-semibold text-olive-soft">
          {rxList.length} 张
        </span>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-olive-mute">
        伴学师为你开的训练处方：照着做，完成一项就在心里打个勾。
      </p>
      <div className="mt-3 space-y-2.5">
        {rxList.map((rx) => {
          const open = openId === rx.id;
          return (
            <div key={rx.id} className="rounded-xl border border-border bg-cream/70">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : rx.id)}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
              >
                <span className="text-[13.5px] font-semibold text-olive">
                  {rx.tutorName} 的处方 · {rx.methods.length} 个方法{rx.customText ? " + 补充方案" : ""}
                </span>
                <span className="mono ml-auto text-[11px] text-olive-mute">
                  {new Date(rx.createdAt).toLocaleDateString("zh-CN")}
                </span>
                {open ? <ChevronUp size={14} className="text-olive-mute" /> : <ChevronDown size={14} className="text-olive-mute" />}
              </button>
              {open && (
                <div className="space-y-2 border-t border-border px-3.5 py-3">
                  {rx.methods.map((m, i) => {
                    const full = METHOD_BY_ID.get(m.id);
                    const mKey = `${rx.id}-${m.id}`;
                    const mOpen = openMethod === mKey;
                    return (
                      <div key={m.id} className="rounded-lg border border-cream-deep bg-white/70">
                        <button
                          type="button"
                          onClick={() => setOpenMethod(mOpen ? null : mKey)}
                          className="flex w-full items-center justify-between gap-1.5 px-3 py-2 text-left"
                        >
                          <span className="text-[13px] font-semibold text-olive">
                            {i + 1}. {m.name}
                            <span className="ml-1 font-normal text-olive-mute">
                              （{m.ability ? `${m.ability} · ` : ""}{BOARD_LABEL[m.board as "N" | "D" | "X" | "P"] ?? m.board} · {m.sub}）
                            </span>
                          </span>
                          {mOpen ? <ChevronUp size={13} className="shrink-0 text-olive-mute" /> : <ChevronDown size={13} className="shrink-0 text-olive-mute" />}
                        </button>
                        {mOpen && full && (
                          <div className="space-y-1.5 border-t border-cream-deep px-3.5 py-2.5 text-[13px] leading-relaxed text-olive-soft">
                            {full.purpose && <p className="whitespace-pre-line"><b className="text-olive">目的：</b>{full.purpose}</p>}
                            {full.steps.length > 0 && (
                              <ol className="list-decimal space-y-1 pl-5">
                                {full.steps.map((s, si) => (
                                  <li key={si}>{s}</li>
                                ))}
                              </ol>
                            )}
                            {full.schedule && <p><b className="text-olive">频率：</b>{full.schedule}</p>}
                            {full.tool && full.tool !== "无" && <p><b className="text-olive">工具：</b>{full.tool}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {rx.customText && (
                    <div className="rounded-lg border border-butter bg-butter/40 px-3.5 py-2.5 text-[13px] leading-relaxed text-olive">
                      <b>伴学师补充：</b>
                      <p className="mt-0.5 whitespace-pre-line">{rx.customText}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
