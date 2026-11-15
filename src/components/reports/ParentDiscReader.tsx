/**
 * v286 家长 DISC 融合读本：一本两段。
 *
 * 第一部分 = 你的 DISC 形状（原 StandaloneParentDiscReport 的全部内容，一个字没删）；
 * 第二部分 = 今晚这句话怎么说（contracts/familyCommKit 的「家长个人版」七节原话）。
 *
 * 为什么要合成一本：家长扫码测完，拿到过两份东西——一份讲「你是什么型」，一份讲「这句话怎么改」。
 * 分开给，前者像体检单，后者像鸡汤，多数人只看第一份。合成一本之后：
 * 前半本回答「我是谁」，后半本紧接着回答「那今晚我该说什么」，中间用一段过渡把两者接上。
 *
 * 三处共用同一份渲染：后台报告抽屉、/pd 交卷后的结果页、/pd-report 打印页（服务端出 PDF）。
 * 内容全部来自既有引擎，本文件只负责摆——不在渲染层补文案。
 */
import { useMemo } from "react";
import { ArrowRight, Download } from "lucide-react";
import { DISC_ANIMAL, DISC_REPORTS, getDiscCombo } from "@/data/reports";
import { buildCommKit, type KitBook, type KitSection } from "@contracts/familyCommKit";
import { discTendencyFromDims, type DiscResult } from "@contracts/assessments";
import StandaloneParentDiscReport from "@/components/reports/StandaloneParentDiscReport";
import { KitBlockView } from "@/components/reports/FamilyCommKit";

const DIMS = ["D", "I", "S", "C"] as const;
const DIM_NAME = { D: "支配", I: "影响", S: "稳健", C: "谨慎" } as const;

type Props = {
  label: string;
  result: DiscResult;
  /** 打印/PDF 模式：去掉导航与按钮，第二部分强制另起一页 */
  printMode?: boolean;
  /** 导出 PDF；不给就不出按钮 */
  onExport?: () => void;
  exporting?: boolean;
  /** 顶部右侧的一行说明（后台抽屉里放「测于…·已并入/未绑定」） */
  metaText?: string;
};

export default function ParentDiscReader({
  label,
  result,
  printMode = false,
  onExport,
  exporting = false,
  metaText,
}: Props) {
  const combo = getDiscCombo(result.dims);
  const primary = result.primary;
  /* 副维：组合型取第二位；若四维差距大（combo 只有一位），取除主导外最高的那一维 */
  const secondary = combo[1] ?? [...DIMS].sort((a, b) => result.dims[b] - result.dims[a]).find((d) => d !== primary) ?? primary;
  const report = DISC_REPORTS[primary];
  const tendency = discTendencyFromDims(result.dims, result.version);

  /* 绝对分口径：V2 每人每维最多 24 分，旧版 12 分；四维不合计为 100 */
  const total = result.version === 2 ? 24 : 12;
  const bars = useMemo(() => {
    const rows = DIMS.map((d) => ({
      label: `${d} ${DIM_NAME[d]}`,
      value: Math.round((result.dims[d] / total) * 100),
    })).sort((a, b) => b.value - a.value);
    return rows.map((r, i) => ({ ...r, tag: i === 0 ? "主导" : i === 1 ? "副维" : "—" }));
  }, [result.dims, total]);

  /* 后半本：只要家长自己这一份，不需要孩子的数据 */
  const book = useMemo<KitBook | null>(() => {
    const kit = buildCommKit({ parents: [{ label, result }] });
    return kit.books.find((b) => b.key === "parent" && b.ready) ?? null;
  }, [label, result]);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-4">
      {/* ---------------- 封面：翻开之前先知道这本在讲什么 ---------------- */}
      <section className="paper-card overflow-hidden p-5 sm:p-7">
        <div className="flex items-center gap-1.5">
          {["#0C7064", "#52A965", "#D96A4B"].map((c, i) => (
            <span
              key={c}
              className="rounded-full"
              style={{ background: c, width: i === 1 ? 10 : 8, height: i === 1 ? 10 : 8 }}
            />
          ))}
        </div>
        <p className="mono mt-5 text-[10.5px] uppercase tracking-[0.22em] text-olive-mute">
          FOR PARENTS ONLY · DISC &amp; FAMILY TALK
        </p>
        <h2 className="mt-2 text-[26px] font-black leading-tight tracking-tight text-olive sm:text-[32px]">
          {label}，你是 {primary} 主导的人
        </h2>
        <div className="mt-3 h-[3px] w-14 rounded-full bg-brand" />
        <p className="mt-3 text-[13.5px] leading-relaxed text-olive-soft">
          {combo.join("")} 型{report ? ` · ${report.name}` : ""}；{DISC_ANIMAL[primary]}为主，
          {DISC_ANIMAL[secondary]}副之。前半本讲「你是什么样」，后半本讲「今晚这句话怎么说」。
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-olive-soft">{result.summary}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-white px-3.5 py-3">
            <p className="mono text-[10px] tracking-[0.12em] text-[#C08A2E]">PART 01</p>
            <p className="mt-1 text-[14px] font-bold text-olive">你的 DISC 形状</p>
            <p className="mt-1 text-[12px] leading-relaxed text-olive-mute">
              四个维度、管教风格、以及强项容易遮住什么。
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-white px-3.5 py-3">
            <p className="mono text-[10px] tracking-[0.12em] text-[#C08A2E]">PART 02</p>
            <p className="mt-1 text-[14px] font-bold text-olive">今晚这句话怎么说</p>
            <p className="mt-1 text-[12px] leading-relaxed text-olive-mute">
              七节原话：什么场景、你平常怎么讲、换成哪句、为什么这句对你有效。
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border/70 bg-white px-3.5 py-3">
          <p className="text-[11.5px] text-olive-mute">你的四个维度（0—100 绝对分，四维合计不固定为 100）</p>
          <div className="mt-2 space-y-1.5">
            {bars.map((r) => (
              <div key={r.label} className="flex items-center gap-2.5">
                <span className="w-16 shrink-0 text-[12.5px] text-olive">{r.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(3, r.value))}%`,
                      background: r.tag === "主导" ? "#0C7064" : r.tag === "副维" ? "#52A965" : "#CFD8CD",
                    }}
                  />
                </div>
                <span className="mono w-7 shrink-0 text-right text-[12px] font-semibold text-olive">{r.value}</span>
                <span className="w-8 shrink-0 text-[10.5px] text-olive-mute">{r.tag === "—" ? "" : r.tag}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-brand-pale/45 px-4 py-1.5">
          <div className="flex gap-3 border-b border-border/40 py-2 text-[12px]">
            <span className="w-[68px] shrink-0 text-olive-mute">这份给谁</span>
            <span className="flex-1 font-semibold leading-relaxed text-olive">
              {label}自己看。不讨论「你们俩」，只讨论你自己怎么开口。
            </span>
          </div>
          <div className="flex gap-3 border-b border-border/40 py-2 text-[12px]">
            <span className="w-[68px] shrink-0 text-olive-mute">怎么来的</span>
            <span className="flex-1 font-semibold leading-relaxed text-olive">
              24 组二选一折算成 D / I / S / C 四维分；后半本的沟通建议由同一份作答推导，不另填问卷。
            </span>
          </div>
          <div className="flex gap-3 py-2 text-[12px]">
            <span className="w-[68px] shrink-0 text-olive-mute">怎么读</span>
            <span className="flex-1 font-semibold leading-relaxed text-olive">
              先翻到第二部分第 06 节那张六句话的表，挑一句明天就用；其余当背景。
            </span>
          </div>
        </div>
        {metaText && <p className="mt-3 text-[11.5px] text-olive-mute">{metaText}</p>}
      </section>

      {/* ---------------- 段导航 + 导出（屏幕上才有，纸面不要） ---------------- */}
      {!printMode && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-cream/95 p-1.5 backdrop-blur print:hidden">
          <button
            onClick={() => go("pd-part-1")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-olive-soft transition-colors hover:bg-white hover:text-olive"
          >
            <span className="mono text-[11px] text-brand">01</span> 你的 DISC 形状
          </button>
          <ArrowRight size={12} className="text-olive-mute" />
          <button
            onClick={() => go("pd-part-2")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-olive-soft transition-colors hover:bg-white hover:text-olive"
          >
            <span className="mono text-[11px] text-brand">02</span> 今晚这句话怎么说
          </button>
          {onExport && (
            <button
              onClick={onExport}
              disabled={exporting}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-50"
            >
              <Download size={13} />
              {exporting ? "正在生成 PDF…" : "导出 PDF"}
            </button>
          )}
        </div>
      )}

      {/* ---------------- 第一部分：DISC 形状 ---------------- */}
      <section id="pd-part-1" className="scroll-mt-16 space-y-3">
        <PartHead no="第一部分" title="你的 DISC 形状" note={`${label} · ${primary} 主导 · ${tendency[primary] > 0 ? "+" : ""}${tendency[primary]}%`} />
        <p className="px-1 text-[13.5px] leading-relaxed text-olive-soft">
          下面这张图是你这份作答的原始倾向：以 0% 为中线，往右是这一维偏强，往左是偏弱。
          四个数字加起来恒为 0，所以它说明的是<b className="text-olive">形状</b>，不是「总分高低」。
        </p>
        {/* 原有家长 DISC 报告原样搬过来：一道题、一张图、一句结论都不改 */}
        <StandaloneParentDiscReport label={label} result={result} />
        <div className="rounded-xl border-l-[3px] border-[#C08A2E] bg-[#F7F2E4] px-4 py-3">
          <p className="text-[12.5px] font-bold text-[#8A6500]">为什么后面还有一半</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">
            到这里为止，讲的都是「你是什么样」。但家长真正卡住的地方，通常不是不知道自己什么性格，
            而是<b className="text-olive">明明知道，那句话还是照原样说出口了</b>。
            所以下半本不再分析你，只给能照着念的原话。
          </p>
        </div>
      </section>

      {/* ---------------- 第二部分：沟通建议 ---------------- */}
      <section id="pd-part-2" className="scroll-mt-16 space-y-3">
        <PartHead no="第二部分" title="今晚回家，第一句话怎么说" note="按你自己这一型写的，不含孩子的数据" />
        <p className="px-1 text-[13.5px] leading-relaxed text-olive-soft">
          这一部分的每一节只做一件事：把「你的性格」翻译成「一句能说出口的话」。
          不用全做——挑一节，做两周，比七节都试一遍有用。
        </p>

        {book ? (
          <>
            {/* 目录：七节各管一段，先让人选入口 */}
            <div className="paper-card p-5 print:break-inside-avoid">
              <div className="grid gap-x-6 sm:grid-cols-2">
                {book.sections.map((s) => (
                  <div key={s.no} className="flex items-baseline gap-2.5 border-b border-border/60 py-1.5 last:border-0">
                    <span className="mono w-6 shrink-0 text-[12px] font-bold text-brand">{s.no}</span>
                    <span className="text-[13px] font-semibold text-olive">{s.title}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                <Pick title="不知道从哪开始" text="看 07，只改一个动作，做两周。" />
                <Pick title="明天就得用" text="看 06，六句话直接照念，先练「作业拖延」那句。" />
                <Pick title="想先弄明白自己" text="看 03—04，你落在哪一格、强项遮了什么。" />
              </div>
            </div>

            {book.sections.map((s) => (
              <KitSectionCard key={s.no} s={s} />
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="paper-card p-5">
                <p className="text-[13.5px] font-bold text-olive">想让孩子也测一份</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-olive-soft">
                  他做完，这一本就会变成《家庭沟通锦囊 · 家长家庭综合版》：每位成员一张说明、每对一张应对，
                  还能逐维标出你们俩差在哪里。一个人有一份说明书，两个人才能有一本对话录。
                </p>
              </div>
              <div className="paper-card p-5">
                <p className="text-[13.5px] font-bold text-olive">这份怎么用</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-olive-soft">
                  不建议打印出来讲给孩子听。你自己先照第 06 节练一句，两周后再看最后那张表——
                  他多说一句话，就是通道开始通。
                </p>
              </div>
            </div>

            <p className="px-1 text-[11px] leading-relaxed text-olive-mute">
              这份读本只解释性格节奏带来的沟通错位，不含学业诊断与心理评估。所有建议都不做效果承诺；
              涉及边界问题（动手、长期辱骂、威胁、翻手机当众念出）请拨 12355 或联系学校心理老师。
            </p>
          </>
        ) : (
          <p className="paper-card p-6 text-center text-[13px] text-olive-mute">
            这一份沟通建议暂时出不来（作答数据不完整），可以联系老师重新测一次。
          </p>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PartHead({ no, title, note }: { no: string; title: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-[2.5px] border-[#24382F] px-1 pb-2 print:break-after-avoid">
      <div className="flex items-baseline gap-2.5">
        <span className="mono text-[11px] tracking-wider text-olive-mute">{no}</span>
        <h3 className="text-[17px] font-bold text-olive">{title}</h3>
      </div>
      <span className="text-[11.5px] text-olive-mute">{note}</span>
    </div>
  );
}

function Pick({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-cream-deep/40 px-3 py-2.5">
      <p className="text-[12.5px] font-bold text-brand">{title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-olive-soft">{text}</p>
    </div>
  );
}

function KitSectionCard({ s }: { s: KitSection }) {
  return (
    <section className="paper-card p-5">
      <div className="flex items-baseline gap-2">
        <span className="mono text-[11.5px] text-brand">{s.no}</span>
        <h4 className="text-[15.5px] font-bold text-olive">{s.title}</h4>
      </div>
      {s.lead && <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">{s.lead}</p>}
      <div className="mt-3 space-y-3">
        {s.blocks.map((b, i) => (
          <KitBlockView key={i} b={b} />
        ))}
      </div>
    </section>
  );
}
