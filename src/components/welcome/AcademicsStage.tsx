import { trpc } from "@/providers/trpc";
import { type AcademicsData } from "@contracts/academics";
import AcademicsEditorCore, { type AcademicsSubmit } from "@/components/companion/AcademicsEditorCore";

/** 向导第 2 阶段：成绩与目标（最近一次大考 + 各科目标，可跳过）。 */
export default function AcademicsStage({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.profile.get.useQuery();

  const save = trpc.profile.saveAcademics.useMutation({
    onSuccess: () => {
      utils.profile.get.invalidate();
      utils.assessment.latest.invalidate();
      onNext();
    },
  });

  if (isLoading) {
    return <div className="paper-card h-32 animate-pulse bg-cream-deep/50" />;
  }

  const onSubmit = (data: AcademicsSubmit) => save.mutate(data);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-olive">成绩与目标</h2>
        <p className="mt-1 text-[14px] text-olive-soft">
          填一填最近一次大考，综合报告就能帮你把差距拆成小台阶。没考过或想不起来，也可以先跳过。
        </p>
      </div>

      <AcademicsEditorCore
        grade={profile?.grade}
        initial={profile?.academics as AcademicsData | null | undefined}
        submitting={save.isPending}
        submitLabel="保存并继续"
        onSubmit={onSubmit}
        footer={
          save.isError ? (
            <p className="mt-2 text-center text-[13px] text-terra">保存失败，请再试一次，或直接跳过</p>
          ) : undefined
        }
      />

      <button
        onClick={onSkip}
        className="mt-4 w-full text-center text-[13px] text-olive-mute hover:text-olive"
      >
        先跳过，稍后在个人中心填 →
      </button>
    </div>
  );
}
