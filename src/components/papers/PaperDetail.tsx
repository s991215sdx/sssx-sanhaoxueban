import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { BANDS } from "@contracts/content";
import { ArrowLeft, CalendarDays, GraduationCap, Trash2, X } from "lucide-react";
import PaperResultView from "./PaperResultView";
import { ITEM_RESULT_LABEL, parseSummary } from "./shared";

const RESULT_STYLE: Record<string, string> = {
  right: "bg-lime/15 text-lime",
  wrong: "bg-terra/15 text-terra",
  half: "bg-butter/60 text-olive",
};

/** 试卷详情：照片（可点开大图）+ 逐题表 + summary。 */
export default function PaperDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { data: paper, isLoading } = trpc.paper.get.useQuery({ id });
  const { data: chapters } = trpc.graph.overview.useQuery();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const navigate = useNavigate();

  const remove = trpc.paper.remove.useMutation({
    onSuccess: () => {
      void utils.paper.list.invalidate();
      onBack();
    },
  });

  const kpTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const ch of chapters ?? []) for (const k of ch.kps) map.set(k.code, k.title);
    return map;
  }, [chapters]);

  if (isLoading || !paper) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
      </div>
    );
  }

  const summary = parseSummary(paper.summary);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-olive-mute hover:text-olive">
          <ArrowLeft size={15} />
          返回列表
        </button>
        <button
          onClick={() => {
            if (window.confirm("确定删除这份试卷吗？已收进错题本的错题会保留。")) remove.mutate({ id });
          }}
          disabled={remove.isPending}
          className="flex items-center gap-1 text-sm text-olive-mute hover:text-terra"
        >
          <Trash2 size={14} />
          删除试卷
        </button>
      </div>

      {/* 头部信息 */}
      <div className="paper-card p-5">
        <h2 className="text-lg font-bold text-olive">{paper.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {paper.examDate && (
            <span className="chip !text-[11px] text-olive-soft">
              <CalendarDays size={11} />
              {paper.examDate}
            </span>
          )}
          {paper.score && <span className="chip !text-[11px] text-olive">得分 {paper.score}</span>}
          <span className="chip !text-[11px] text-olive-mute">共 {paper.items.length} 题</span>
        </div>
      </div>

      {/* 照片墙 */}
      {paper.images.length > 0 && (
        <div className="paper-card p-5">
          <div className="mono text-[10px] tracking-wider text-olive-mute">试卷照片 · 点开看大图</div>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {paper.images.map((src, i) => (
              <button
                key={i}
                onClick={() => setLightbox(src)}
                className="aspect-[3/4] overflow-hidden rounded-xl border border-border bg-cream transition-transform hover:scale-[1.02]"
              >
                <img src={src} alt={`试卷第${i + 1}页`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 逐题表 */}
      {paper.items.length > 0 && (
        <div className="paper-card overflow-hidden">
          <div className="mono border-b border-border px-5 py-3 text-[10px] tracking-wider text-olive-mute">
            逐题定性
          </div>
          <div className="divide-y divide-border">
            {paper.items.map((it) => {
              const band = BANDS.find((b) => b.band === it.band);
              const itemScore = it.score ?? 5;
              const lost = it.result === "wrong" ? itemScore : it.result === "half" ? itemScore / 2 : 0;
              const linkedErrorId = summary?.itemErrorMap?.[String(it.no)];
              return (
                <div key={it.no} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5">
                  <span className="mono w-7 text-[13.5px] font-bold text-olive">{it.no}</span>
                  <span
                    className={`mono rounded-lg px-2 py-0.5 text-[11px] font-bold ${RESULT_STYLE[it.result] ?? ""}`}
                  >
                    {ITEM_RESULT_LABEL[it.result]}
                  </span>
                  {band && (
                    <span className="chip !border-0 !text-[10px] text-white" style={{ backgroundColor: band.color }}>
                      {band.short}
                    </span>
                  )}
                  {it.kpCode && (
                    <span className="text-[12.5px] text-olive-soft">{kpTitle.get(it.kpCode) ?? it.kpCode}</span>
                  )}
                  {it.cause && <span className="text-[12px] text-olive-mute">错因：{it.cause}</span>}
                  {lost > 0 && <span className="mono text-[12px] font-bold text-terra">-{lost} 分</span>}
                  {linkedErrorId && (
                    <button
                      onClick={() => navigate(`/learn/${linkedErrorId}`)}
                      className="ml-auto flex items-center gap-1 rounded-lg border border-lime/60 bg-lime-pale/50 px-2.5 py-1 text-[12px] font-medium text-olive transition-colors hover:bg-lime-pale"
                    >
                      <GraduationCap size={13} />
                      学伴带我学
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 分析摘要 */}
      {summary ? (
        <div>
          <div className="mono mb-2.5 text-[10px] tracking-wider text-olive-mute">分析结果</div>
          <PaperResultView summary={summary} />
        </div>
      ) : (
        <div className="paper-card p-6 text-center text-sm text-olive-mute">这份试卷还没有做逐题分析。</div>
      )}

      {/* 大图灯箱 */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-olive/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            aria-label="关闭大图"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-cream text-olive"
          >
            <X size={18} />
          </button>
          <img
            src={lightbox}
            alt="试卷大图"
            className="max-h-full max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
