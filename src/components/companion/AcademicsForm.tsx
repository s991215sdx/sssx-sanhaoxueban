import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { type AcademicsData } from "@contracts/academics";
import AcademicsEditorCore, { type AcademicsSubmit } from "./AcademicsEditorCore";

/** 伴学师 · 学科自评与目标表单（薄壳：加载档案 + 调 saveAcademics，表单主体见 AcademicsEditorCore）。 */
export default function AcademicsForm() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.profile.get.useQuery();
  const [saved, setSaved] = useState(false);

  const save = trpc.profile.saveAcademics.useMutation({
    onSuccess: () => {
      utils.profile.get.invalidate();
      utils.assessment.latest.invalidate();
      setSaved(true);
    },
  });

  if (isLoading) {
    return <div className="paper-card h-32 animate-pulse bg-cream-deep/50" />;
  }
  if (!profile) return null;

  const onSubmit = (data: AcademicsSubmit) => {
    setSaved(false);
    save.mutate(data);
  };

  return (
    <AcademicsEditorCore
      grade={profile.grade}
      initial={profile.academics as AcademicsData | null | undefined}
      submitting={save.isPending}
      onSubmit={onSubmit}
      footer={
        <>
          {saved && !save.isPending && (
            <p className="mt-2 text-center text-[13px] font-medium text-olive">已保存 ✓ 综合报告已更新</p>
          )}
          {save.isError && <p className="mt-2 text-center text-[13px] text-terra">保存失败，请再试一次。</p>}
        </>
      }
    />
  );
}
