import { useState } from "react";
import { Check, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { CAMPUS_REPORT_DEFS } from "@contracts/campusReports";

export type CampusReportTarget = {
  userId: number;
  name: string;
  doneKinds: string[];
  campusReportKinds: string[];
};

/** 每名学生独立授权。可以预先授权未完成报告；未完成状态不影响老师安排测评。 */
export default function CampusReportAccessPanel({ student, onClose, onSaved }: {
  student: CampusReportTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(student.campusReportKinds);
  const mutation = trpc.school.assessCenter.setReports.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
  });
  const groups = [...new Set(CAMPUS_REPORT_DEFS.map((d) => d.group))];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-bold text-[#1E3530]">{student.name} · 测评报告授权</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#70827B]">勾选后，学生及家长前台即可看到对应报告；取消勾选即收回。每套心理量表、选科综合报告均独立授权。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#70827B] hover:bg-black/5" aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="mt-4 space-y-4">
          {groups.map((group) => (
            <section key={group}>
              <h4 className="mb-2 text-[13px] font-bold text-[#0C7064]">{group}</h4>
              <div className="space-y-2">
                {CAMPUS_REPORT_DEFS.filter((d) => d.group === group).map((report) => {
                  const checked = selected.includes(report.key);
                  const done = report.resultKinds.some((kind) => student.doneKinds.includes(kind));
                  return (
                    <label key={report.key} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${checked ? "border-[#0C7064] bg-[#EDF6F1]" : "border-[#DCE5DF]"}`}>
                      <input type="checkbox" className="h-4 w-4 accent-[#0C7064]" checked={checked} onChange={() => setSelected((prev) => checked ? prev.filter((k) => k !== report.key) : [...prev, report.key])} />
                      <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#1E3530]">{report.label}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${done ? "bg-[#E3F1EB] text-[#0C7064]" : "bg-[#F1F3F0] text-[#70827B]"}`}>{done ? "已完成" : "待测评"}</span>
                      {checked && <Check size={15} className="shrink-0 text-[#0C7064]" />}
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-4 rounded-lg bg-[#F5F7F2] px-3 py-2 text-[11.5px] leading-relaxed text-[#70827B]">学科四维结果纳入“选科及升学规划综合报告”，不虚构独立报告栏目；综合报告还需霍兰德、成绩与未来期望等数据。</p>
        {mutation.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{mutation.error.message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#DCE5DF] px-4 py-2 text-[12.5px] font-semibold text-[#1E3530]">取消</button>
          <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ userId: student.userId, kinds: selected })} className="rounded-lg bg-[#0C7064] px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50">{mutation.isPending ? "保存中…" : `保存授权（${selected.length} 份）`}</button>
        </div>
      </div>
    </div>
  );
}
