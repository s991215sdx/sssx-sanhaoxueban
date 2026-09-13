import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { pickAndCompress } from "@/lib/image";
import { Camera, Loader2, X } from "lucide-react";
import { defaultPaperTitle, todayStr } from "./shared";

const MAX_IMAGES = 6;

/** 新建流第 1 步：拍照上传 + 基本信息。 */
export default function PaperUploadStep({ onCreated }: { onCreated: (id: number) => void }) {
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState(defaultPaperTitle);
  const [examDate, setExamDate] = useState(todayStr);
  const [score, setScore] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const create = trpc.paper.create.useMutation({
    onSuccess: (d) => onCreated(d.id),
    onError: (e) => setError(e.message || "保存失败，再试一次"),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || busy) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        let next: string | null = null;
        try {
          next = await pickAndCompress(file);
        } catch (err) {
          setError(err instanceof Error ? err.message : "图片处理失败");
          continue;
        }
        setImages((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, next!]));
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const valid = title.trim().length > 0 && images.length > 0;

  return (
    <div className="paper-card space-y-5 p-6">
      <div>
        <div className="mono text-[11px] tracking-wider text-olive-mute">1 · 把试卷拍下来（最多 {MAX_IMAGES} 张）</div>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {images.map((src, i) => (
            <div key={i} className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-cream">
              <img src={src} alt={`试卷第${i + 1}页`} className="h-full w-full object-cover" />
              <button
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                aria-label="删除这张照片"
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-olive/80 text-cream hover:bg-terra"
              >
                <X size={13} />
              </button>
              <span className="mono absolute bottom-1.5 left-1.5 rounded-md bg-cream/90 px-1.5 py-0.5 text-[10px] text-olive">
                第{i + 1}页
              </span>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-olive/25 bg-cream/60 text-olive-mute transition-colors hover:border-lime hover:text-olive"
            >
              {busy ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
              <span className="text-[12px]">{busy ? "压缩中…" : "拍照/上传"}</span>
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <p className="mt-2 text-[12.5px] text-olive-mute">照片会自动压缩，只存在你自己的学伴里。</p>
      </div>

      <div>
        <label className="mono text-[11px] tracking-wider text-olive-mute">2 · 给它起个名字</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={64}
          placeholder="例如：初三上期中数学卷"
          className="mt-2 w-full rounded-xl border border-input bg-cream px-4 py-2.5 text-[15px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mono text-[11px] tracking-wider text-olive-mute">3 · 考试日期</label>
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-input bg-cream px-4 py-2.5 text-[15px] text-olive outline-none focus:border-lime focus:ring-2 focus:ring-lime/25"
          />
        </div>
        <div>
          <label className="mono text-[11px] tracking-wider text-olive-mute">4 · 得分（选填）</label>
          <input
            value={score}
            onChange={(e) => setScore(e.target.value)}
            maxLength={16}
            placeholder="如 82/100"
            className="mt-2 w-full rounded-xl border border-input bg-cream px-4 py-2.5 text-[15px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25"
          />
        </div>
      </div>

      {error && <p className="text-[13px] text-terra">{error}</p>}

      <button
        onClick={() =>
          valid &&
          create.mutate({
            title: title.trim(),
            examDate: examDate || undefined,
            score: score.trim() || undefined,
            images,
          })
        }
        disabled={!valid || create.isPending || busy}
        className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
      >
        {create.isPending ? "正在保存试卷…" : "下一步：逐题定性 →"}
      </button>
    </div>
  );
}
