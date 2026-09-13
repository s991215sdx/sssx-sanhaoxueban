import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import VariantTrainer from "@/components/VariantTrainer";
import RecordingSection from "@/components/companion/RecordingSection";
import { MasteryBar } from "@/components/ScoreRing";
import { BANDS, type Band } from "@contracts/content";
import { GRADES, STAGES, STAGE_GRADES } from "@contracts/constants";
import { pickAndCompress } from "@/lib/image";
import { AlarmClock, BookMarked, PenLine, GitBranch, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Camera, X, GraduationCap, Mic } from "lucide-react";

const CAUSE_COLORS: Record<string, string> = {
  概念不清: "#7cb83c",
  审题失误: "#c7a23a",
  计算错误: "#cf6a3c",
  方法不会: "#556339",
  粗心大意: "#8b9468",
};

const FIELD_CLS = "mt-2 w-full rounded-xl border border-input bg-cream px-4 py-2.5 text-[15px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25";

type Tab = "review" | "book" | "add" | "recording";

function Spin() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
    </div>
  );
}

function BandChip({ band }: { band: number }) {
  const b = BANDS.find((x) => x.band === band) ?? BANDS[1];
  return (
    <span className="chip !border-0 !text-[11px]" style={{ backgroundColor: `${b.color}22`, color: b.color }}>
      {b.short}
    </span>
  );
}

export default function Gaps() {
  const [tab, setTab] = useState<Tab>("review");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-olive">查漏补缺</h1>
          <p className="mt-1 text-[15px] text-olive-soft">错题不只改答案——找到错因、回溯根因、变式训练、间隔复习，四步闭环。</p>
        </div>
        <Link
          to="/papers"
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-cream-card px-4 py-2 text-sm font-medium text-olive transition-colors hover:bg-lime-pale"
        >
          <ClipboardList size={15} />
          试卷分析 →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "review", label: "今日复习", icon: AlarmClock },
            { key: "book", label: "错题本", icon: BookMarked },
            { key: "add", label: "录入错题", icon: PenLine },
            { key: "recording", label: "课堂录音", icon: Mic },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14.5px] font-medium transition-colors ${tab === t.key ? "bg-olive text-cream" : "bg-cream-card border border-border text-olive-soft hover:bg-lime-pale/60"}`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "review" && <ReviewQueue />}
      {tab === "book" && <ErrorBook />}
      {tab === "add" && <AddErrorForm onDone={() => setTab("book")} />}
      {tab === "recording" && <RecordingSection />}
    </div>
  );
}

/* ------------------------------ 今日复习 ------------------------------ */

function ReviewQueue() {
  const { data, isLoading } = trpc.gaps.todayReviews.useQuery(undefined, { retry: 5, retryDelay: 3000 });
  const [activeId, setActiveId] = useState<number | null>(null); // reviewItemId
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());
  const complete = trpc.gaps.completeReview.useMutation();

  const items = useMemo(() => (data ?? []).filter((d) => !doneIds.has(d.id)), [data, doneIds]);
  const active = items.find((i) => i.id === activeId);

  if (isLoading) return <Spin />;

  if (active) {
    return (
      <div className="space-y-4">
        <div className="paper-card accent-l border-butter p-5">
          <div className="mono text-[10px] tracking-wider text-olive-mute">复习题对应的原始错题 · {active.kpTitle}</div>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-olive">{active.stem}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="chip" style={{ color: CAUSE_COLORS[active.cause] }}>错因：{active.cause}</span>
            <BandChip band={active.band} />
          </div>
        </div>
        <VariantTrainer
          errorId={active.errorLogId}
          initialStreak={0}
          onResult={(correct) => {
            complete.mutate({ reviewItemId: active.id, correct });
            setDoneIds((s) => new Set(s).add(active.id));
            setActiveId(null);
          }}
        />
        <button onClick={() => setActiveId(null)} className="text-sm text-olive-mute hover:text-olive">
          ← 返回复习队列
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <div className="paper-card p-8 text-center">
          <CheckCircle2 className="mx-auto text-lime" size={32} />
          <p className="mt-2 font-semibold text-olive">今天没有到期的复习</p>
          <p className="mt-1 text-sm text-olive-mute">录入一道错题，系统会自动安排 1/3/7/15/30 天的复习节奏。</p>
        </div>
      )}
      {items.map((it) => (
        <div key={it.id} className="paper-card flex items-center gap-4 p-4">
          <div className="mono flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-butter/60 text-olive">
            <span className="text-[9px] tracking-wide">到期</span>
            <span className="text-[13px] font-bold">{it.dueDate.slice(5)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14.5px] font-medium text-olive">{it.kpTitle}</span>
              <span className="chip !text-[11px]" style={{ color: CAUSE_COLORS[it.cause] }}>
                {it.cause}
              </span>
              <BandChip band={it.band} />
            </div>
            <p className="mt-1 truncate text-[13px] text-olive-mute">{it.stem}</p>
          </div>
          <button
            onClick={() => setActiveId(it.id)}
            className="shrink-0 rounded-xl bg-olive px-4 py-2 text-sm font-medium text-cream hover:bg-lime"
          >
            开始复习
          </button>
        </div>
      ))}
      {items.length > 0 && <p className="text-center text-xs text-olive-mute">共 {items.length} 项到期 · 答错的会自动安排明天再复习</p>}
    </div>
  );
}

/* ------------------------------- 错题本 ------------------------------- */

function ErrorBook() {
  const { data, isLoading } = trpc.gaps.listErrors.useQuery(undefined, { retry: 5, retryDelay: 3000 });
  const [openId, setOpenId] = useState<number | null>(null);

  if (isLoading) return <Spin />;
  if (!data || data.length === 0) {
    return (
      <div className="paper-card p-8 text-center">
        <BookMarked className="mx-auto text-olive-mute" size={30} />
        <p className="mt-2 font-semibold text-olive">错题本还是空的</p>
        <p className="mt-1 text-sm text-olive-mute">去「录入错题」记下第一道错题，开始找到知识的漏洞。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((e) => {
        const open = openId === e.id;
        return (
          <div key={e.id} className={`paper-card overflow-hidden ${open ? "border-olive/40" : ""}`}>
            <button onClick={() => setOpenId(open ? null : e.id)} className="flex w-full items-center gap-3 p-4 text-left">
              <span
                className={`mono shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold ${e.status === "mastered" ? "bg-lime text-white" : "bg-terra/15 text-terra"}`}
              >
                {e.status === "mastered" ? "已攻克" : "待攻克"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-medium text-olive">{e.kpTitle}</span>
                  <span className="chip !text-[11px]" style={{ color: CAUSE_COLORS[e.cause] }}>{e.cause}</span>
                  <BandChip band={e.band} />
                  {e.hasImage && <span title="有题目照片">📷</span>}
                  {e.nextDue && e.status === "active" && (
                    <span className="chip !text-[11px] text-olive-mute">下次复习 {e.nextDue.slice(5)}</span>
                  )}
                </div>
                <p className="mt-1 truncate text-[13px] text-olive-mute">{e.stem}</p>
              </div>
              {open ? <ChevronUp size={17} className="shrink-0 text-olive-mute" /> : <ChevronDown size={17} className="shrink-0 text-olive-mute" />}
            </button>
            {open && <ErrorDetail errorId={e.id} streak={e.variantStreak} hasImage={e.hasImage} />}
          </div>
        );
      })}
    </div>
  );
}

function ErrorDetail({ errorId, streak, hasImage }: { errorId: number; streak: number; hasImage: boolean }) {
  const { data } = trpc.gaps.analyze.useQuery({ errorId });
  const { data: img } = trpc.gaps.getImage.useQuery({ errorId }, { enabled: hasImage });
  const navigate = useNavigate();
  if (!data) {
    return (
      <div className="flex justify-center border-t border-border py-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-lime border-t-transparent" />
      </div>
    );
  }
  return (
    <div className="space-y-5 border-t border-border bg-cream/40 p-5">
      {/* 题目照片（懒加载） */}
      {hasImage && img?.imageData && (
        <div>
          <div className="mono mb-2 text-[10px] tracking-wider text-olive-mute">题目照片</div>
          <img src={img.imageData} alt="错题照片" className="max-h-72 rounded-xl border border-border" />
        </div>
      )}

      {/* 错因分析 */}
      <div className="accent-l border-terra">
        <div className="mono text-[10px] tracking-wider text-olive-mute">错因分析 · {data.error.cause}</div>
        <p className="mt-1.5 text-[14px] leading-relaxed text-olive">{data.causeAdvice ?? "这类错误在这个知识点上很常见，建议回到精讲重新理解。"}</p>
        {data.error.note && <p className="mt-1 text-[13px] text-olive-mute">备注：{data.error.note}</p>}
      </div>

      {/* 根因回溯链 */}
      {data.chain.length > 1 && (
        <div>
          <div className="flex items-center gap-1.5 mono text-[10px] tracking-wider text-olive-mute">
            <GitBranch size={12} />
            根因回溯链（沿前置知识向上找）
          </div>
          <div className="mt-2.5 space-y-2">
            {data.chain.map((node) => (
              <div
                key={node.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${node.isRoot ? "border-terra bg-terra/10" : node.isSelf ? "border-olive/30 bg-cream-card" : "border-border bg-cream-card/60"}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-olive">{node.title}</span>
                    {node.isSelf && <span className="chip !text-[10px] text-olive-mute">本知识点</span>}
                    {node.isRoot && <span className="chip !border-0 bg-terra text-[10px] text-white">根因嫌疑</span>}
                  </div>
                  <MasteryBar score={node.score} className="mt-1.5 max-w-40" />
                </div>
                <span className="mono text-xs text-olive-mute">{node.score}分</span>
              </div>
            ))}
          </div>
          {data.root && (
            <p className="mt-2 text-[13px] leading-relaxed text-olive-soft">💡 系统判断：漏洞的根可能在「{data.root.title}」（掌握度 {data.root.score}），下面的变式训练会先从这里练起。</p>
          )}
        </div>
      )}

      {/* 学伴引导学习：复习卡 → 重做 → 苏格拉底一问一答 */}
      <button
        onClick={() => navigate(`/learn/${errorId}`)}
        className="flex w-full items-center gap-3 rounded-xl border border-lime/60 bg-lime-pale/50 px-4 py-3.5 text-left transition-colors hover:bg-lime-pale"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-olive text-cream">
          <GraduationCap size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-[14px] font-semibold text-olive">还是不会？让学伴带我学</span>
          <span className="mt-0.5 block text-[12px] leading-relaxed text-olive-mute">
            先看复习卡，再做一道题；做错了学伴一个问题一个问题陪你想到底，绝不直接给答案。
          </span>
        </span>
        <ChevronDown size={16} className="-rotate-90 shrink-0 text-olive-mute" />
      </button>

      {/* 变式训练 */}
      <div>
        <div className="mono mb-2.5 text-[10px] tracking-wider text-olive-mute">变式训练 · 连对 3 题攻克此错题</div>
        <VariantTrainer errorId={errorId} initialStreak={streak} />
      </div>
    </div>
  );
}

/* ------------------------------ 录入错题 ------------------------------ */

function AddErrorForm({ onDone }: { onDone: () => void }) {
  // 错题可能属于非档案年级（如复习旧年级内容），需要全年级章节
  const { data: chapters } = trpc.graph.overview.useQuery({ allGrades: true });
  const { data: profile } = trpc.profile.get.useQuery();
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const profileGrade = profile?.grade && GRADES.includes(profile.grade) ? profile.grade : "初一";
  const activeGrade = gradeFilter ?? profileGrade;
  const gradeChapters = chapters?.filter((ch) => ch.grade === activeGrade);
  const [kpId, setKpId] = useState<number | "">("");
  const [stem, setStem] = useState("");
  const [cause, setCause] = useState<string | null>(null);
  const [band, setBand] = useState<Band>(2);
  const [imageData, setImageData] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [rootInfo, setRootInfo] = useState<{ title: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const causes = ["概念不清", "审题失误", "计算错误", "方法不会", "粗心大意"];

  const add = trpc.gaps.addError.useMutation({
    onSuccess: (d) => {
      utils.gaps.listErrors.invalidate();
      utils.gaps.todayReviews.invalidate();
      utils.dashboard.summary.invalidate();
      setRootInfo(d.root);
      setStem("");
      setNote("");
      setCause(null);
      setBand(2);
      setImageData(null);
    },
  });

  const classify = trpc.gaps.autoClassify.useMutation();

  const valid = kpId !== "" && stem.trim().length >= 2 && cause;

  /** AI 自动识别：图片或题干 → 题干转录 + 知识点 + 归因，全部可再手动改。 */
  const runClassify = async (img: string | null, text: string) => {
    if (!img && text.trim().length < 2) return;
    setAnalyzing(true);
    setAiNote(null);
    try {
      const r = await classify.mutateAsync(
        img ? { imageData: img, ...(text.trim() ? { stem: text.trim() } : {}) } : { stem: text.trim() },
      );
      if (r.stem) setStem(r.stem);
      if (r.kpId != null && chapters) {
        const ch = chapters.find((c) => c.kps.some((k) => k.id === r.kpId));
        if (ch) setGradeFilter(ch.grade);
        setKpId(r.kpId);
      }
      if (r.cause) setCause(r.cause);
      setAiNote(
        r.ai
          ? `AI 已自动${r.stem ? "转录题目（已填入下方文本框，请核对）、" : ""}${r.subject ? `判定为【${r.subject}】、` : ""}匹配知识点并归因（把握 ${Math.round(r.confidence * 100)}%），请核对后保存，改哪里都可以。`
          : "已为你做了初步匹配，请核对题目转录、知识点与错因。",
      );
    } catch {
      setAiNote("自动识别暂时不可用，请手动选择知识点与错因。");
    } finally {
      setAnalyzing(false);
    }
  };

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPicking(true);
    try {
      const data = await pickAndCompress(f);
      setImageData(data);
      void runClassify(data, stem);
    } catch (err) {
      alert(err instanceof Error ? err.message : "照片处理失败，请重试");
    } finally {
      setPicking(false);
    }
  };

  if (rootInfo !== null || add.isSuccess) {
    return (
      <div className="paper-card p-6 text-center">
        <CheckCircle2 className="mx-auto text-lime" size={32} />
        <p className="mt-2 text-lg font-bold text-olive">错题已收入错题本</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-olive-soft">
          {rootInfo
            ? `系统沿知识图谱回溯，发现根因可能在「${rootInfo.title}」，变式训练会优先从这里开始。`
            : "系统已为它安排 1/3/7/15/30 天的间隔复习，明天见。"}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => {
              setRootInfo(null);
              add.reset();
            }}
            className="rounded-xl border border-olive px-4 py-2 text-sm font-medium text-olive hover:bg-lime-pale"
          >
            再录一道
          </button>
          <button onClick={onDone} className="rounded-xl bg-olive px-4 py-2 text-sm font-medium text-cream hover:bg-lime">
            去错题本看看 →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="paper-card space-y-5 p-6">
      <div>
        <label className="mono text-[11px] tracking-wider text-olive-mute">1 · 它属于哪个知识点？</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-[140px_1fr]">
          <select
            value={activeGrade}
            onChange={(e) => {
              setGradeFilter(e.target.value);
              setKpId("");
            }}
            className="w-full rounded-xl border border-input bg-cream px-3 py-2.5 text-[14px] text-olive outline-none focus:border-lime focus:ring-2 focus:ring-lime/25"
          >
            {STAGES.map((s) => (
              <optgroup key={s} label={s}>
                {STAGE_GRADES[s].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select value={kpId} onChange={(e) => setKpId(e.target.value ? Number(e.target.value) : "")} className="w-full rounded-xl border border-input bg-cream px-4 py-2.5 text-[15px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25">
            <option value="">选择知识点…</option>
            {gradeChapters?.map((ch) => (
              <optgroup key={`${ch.grade}-${ch.name}`} label={ch.name}>
                {ch.kps.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {gradeChapters?.length === 0 && (
          <p className="mt-1.5 text-[12.5px] text-olive-mute">该年级的精讲内容还在建设中，先选有内容的年级录入。</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="mono text-[11px] tracking-wider text-olive-mute">2 · 把错题抄下来（或描述一下）</label>
          <button
            type="button"
            disabled={analyzing || (!imageData && stem.trim().length < 2)}
            onClick={() => void runClassify(imageData, stem)}
            className="flex items-center gap-1 rounded-lg border border-lime bg-lime-pale/60 px-2.5 py-1 text-[12px] font-medium text-olive transition-colors hover:bg-lime-pale disabled:cursor-not-allowed disabled:opacity-40"
          >
            {analyzing ? "AI 识别中…" : "✨ AI 自动识别知识点与错因"}
          </button>
        </div>
        {aiNote && <p className="mt-1.5 text-[12px] leading-relaxed text-lime">{aiNote}</p>}
        <textarea
          value={stem}
          onChange={(e) => setStem(e.target.value)}
          rows={3}
          placeholder="例如：计算 (-2)×(-3) 时我写成了 -6…"
          className={`${FIELD_CLS} resize-none`}
        />
      </div>
      <div>
        <label className="mono text-[11px] tracking-wider text-olive-mute">3 · 你觉得错在哪？（错因归因是关键一步）</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {causes.map((c) => (
            <button
              key={c}
              onClick={() => setCause(c)}
              className={`rounded-xl border px-4 py-2 text-[14px] font-medium transition-colors ${cause === c ? "border-olive bg-olive text-cream" : "border-border bg-cream text-olive-soft hover:border-olive/40"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mono text-[11px] tracking-wider text-olive-mute">4 · 它属于哪个提分区间？</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {BANDS.map((b) => (
            <button
              key={b.band}
              onClick={() => setBand(b.band)}
              className={`rounded-xl border p-3 text-left transition-colors ${band === b.band ? "border-olive bg-lime-pale/60" : "border-border bg-cream hover:border-olive/40"}`}
            >
              <div className="text-[13.5px] font-semibold" style={{ color: b.color }}>
                {b.name}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-olive-mute">{b.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mono text-[11px] tracking-wider text-olive-mute">5 · 题目照片（可选）</label>
        {imageData ? (
          <div className="relative mt-2 inline-block">
            <img src={imageData} alt="错题照片预览" className="max-h-48 rounded-xl border border-border" />
            <button
              onClick={() => setImageData(null)}
              aria-label="删除照片"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-terra text-white"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={picking} className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-olive-mute/50 bg-cream px-4 py-2.5 text-[14px] text-olive-soft transition-colors hover:border-olive disabled:opacity-50">
            <Camera size={16} />
            {picking ? "处理照片中…" : "拍题目照片"}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pickPhoto} />
      </div>

      <div>
        <label className="mono text-[11px] tracking-wider text-olive-mute">6 · 备注（可选）</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="当时是怎么想的？" className={FIELD_CLS} />
      </div>

      <button
        onClick={() => valid && add.mutate({ kpId: Number(kpId), stem: stem.trim(), cause: cause as never, band, note: note || undefined, imageData: imageData ?? undefined })}
        disabled={!valid || add.isPending}
        className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
      >
        {add.isPending ? "正在分析根因…" : "收入错题本，自动安排复习"}
      </button>
    </div>
  );
}
