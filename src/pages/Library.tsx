import { Fragment, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import Pager from "@/components/Pager";
import DisciplineTreeChart from "@/components/reports/DisciplineTreeChart";
import { BookOpen, Briefcase, Building2, ClipboardList, FileSpreadsheet, Info, Network, School, Upload, X } from "lucide-react";

/**
 * v171 智慧生涯 · 资料库（/library）：伴学师/管理员查询三库 + 12 学科门类图。
 * 管理员额外拥有 JSON 分块导入（专业库、院校分数库）与职业库编辑能力。
 */

type TabKey = "majors" | "careers" | "scores" | "universities" | "disciplines";

const TABS: { key: TabKey; label: string; icon: typeof BookOpen }[] = [
  { key: "majors", label: "查专业", icon: BookOpen },
  { key: "universities", label: "查大学", icon: Building2 },
  { key: "careers", label: "职业库", icon: Briefcase },
  { key: "scores", label: "院校专业分数库", icon: ClipboardList },
  { key: "disciplines", label: "12 学科门类", icon: Network },
];

/** 查专业三大领域（掌上高考式归纳）。 */
const FIELD_GROUPS: { label: string; sub: string; menleis: string[] }[] = [
  { label: "自然科学", sub: "理 · 工 · 农 · 医", menleis: ["理学", "工学", "农学", "医学"] },
  { label: "社会科学", sub: "经 · 管 · 法 · 教", menleis: ["经济学", "管理学", "法学", "教育学"] },
  { label: "人文科学", sub: "文 · 史 · 哲 · 艺", menleis: ["文学", "历史学", "哲学", "艺术学"] },
];

const MAJOR_FIELD_LABELS: [key: string, label: string][] = [
  ["one_liner", "一句话介绍"],
  ["intro", "专业介绍"],
  ["jobs", "就业方向"],
  ["goal", "培养目标"],
  ["require", "能力要求"],
  ["knowledge", "知识要求"],
  ["courses", "核心课程"],
  ["kaoyan", "考研方向"],
  ["famous", "著名人物"],
  ["employment", "就业领域"],
  ["regions", "就业地区分布"],
  ["industries", "就业行业分布"],
  ["occupations", "就业岗位分布"],
  ["salary", "薪资走势"],
  ["schools", "开设院校"],
  ["internship", "实习实训"],
  ["certs", "职业资格"],
  ["degree", "授予学位"],
  ["male_pct", "男生比例"],
  ["female_pct", "女生比例"],
];

/** 通用 JSON 分块导入：FileReader 读取 → 分块顺序上传（院校库字段多，块大小 300）。 */
function useJsonImport(
  mutate: (args: { rows: Record<string, unknown>[]; clear: boolean }) => Promise<{ imported: number }>,
  chunkSize = 2000,
) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const run = async (file: File, clear: boolean) => {
    setBusy(true);
    setProgress("读取文件…");
    try {
      const text = await file.text();
      const arr = JSON.parse(text) as Record<string, unknown>[];
      if (!Array.isArray(arr)) throw new Error("文件必须是 JSON 数组");
      const CHUNK = chunkSize;
      let done = 0;
      for (let i = 0; i < arr.length; i += CHUNK) {
        setProgress(`导入中 ${Math.min(i + CHUNK, arr.length)} / ${arr.length}…`);
        const r = await mutate({ rows: arr.slice(i, i + CHUNK), clear: clear && i === 0 });
        done += r.imported;
      }
      setProgress(`完成，共导入 ${done} 条 ✓`);
    } catch (e) {
      setProgress(`失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };
  return { busy, progress, run, reset: () => setProgress("") };
}

function ImportButton({
  onFile,
  label,
  busy,
}: {
  onFile: (f: File) => void;
  label: string;
  busy: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] font-medium whitespace-nowrap text-olive transition-colors hover:bg-mint-pale/60 disabled:opacity-40"
      >
        <Upload size={14} /> {busy ? "导入中…" : label}
      </button>
    </>
  );
}

/* ---------------------------------- 专业库 ---------------------------------- */

/** 12 门类一句话定位（查专业/门类图共用）。 */
const MENLEI_INTRO: Record<string, string> = {
  哲学: "以思辨探究世界本质与价值判断的根基，深造导向明显，是人文素养的塔尖。",
  经济学: "研究资源配置与宏观经济运行，财经商贸与宏观分析的核心学科。",
  法学: "研习规则、社会治理与公共安全，职业资格考试路径清晰的务实学科。",
  教育学: "研究育人方法与学习科学，连接学校、家庭与培训机构的教育行业根基。",
  文学: "语言表达与内容传播的母体，覆盖中外语言、新闻传播与文化创意。",
  历史学: "史料研究与文化传承，训练严谨考证与长时段视野，深造友好。",
  理学: "基础科学的沃土，数学、物理、化学等学科是读研深造与交叉创新的源头。",
  工学: "应用技术主力，就业面最宽，覆盖机械、电子、计算机、土木等 30 余个专业类。",
  农学: "现代农业与生态文明，从分子育种到智慧农业，政策扶持力度持续加大。",
  医学: "周期长、门槛高、社会刚需，临床、口腔、护理等方向职业确定性最强。",
  管理学: "组织运营与商业决策，就业面宽、实践性强，适合沟通与统筹能力突出的学生。",
  艺术学: "创作表达的主阵地，艺考主要方向，数字媒体与游戏美术等新兴方向增长快。",
};

/** 掌上高考式查专业：左侧门类导航（按三大领域分组）+ 右侧专业类卡片流；搜索时切回表格。 */
function MajorsTab({ isAdmin, initialMenlei }: { isAdmin: boolean; initialMenlei?: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [menlei, setMenlei] = useState(initialMenlei ?? searchParams.get("subjectCategory") ?? "");
  const [cat, setCat] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: nav } = trpc.library.majorNav.useQuery();
  const grouped = trpc.library.majorsByMenlei.useQuery(
    { menlei },
    { enabled: !!menlei && !keyword.trim() },
  );
  const searching = !!keyword.trim();
  const query = trpc.library.majors.useQuery(
    { page, pageSize: 20, menlei: menlei || undefined, cat: cat || undefined, keyword: searching ? keyword.trim() : undefined },
    { enabled: !menlei || searching },
  );
  const detail = trpc.library.major.useQuery(
    { id: detailId ?? 0 },
    { enabled: detailId != null },
  );
  const importMut = trpc.library.majorsImport.useMutation();
  const utils = trpc.useUtils();
  const imp = useJsonImport(async ({ rows }) => {
    const r = await importMut.mutateAsync({ rows });
    await utils.library.majors.invalidate();
    await utils.library.majorNav.invalidate();
    await utils.library.majorsByMenlei.invalidate();
    return r;
  });

  const pickMenlei = (m: string) => {
    setMenlei(m);
    setCat("");
    setPage(1);
    setSearchParams(m ? { subjectCategory: m } : {}, { replace: true });
  };
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 20));
  const navCount = (m: string) => nav?.menleis.find((x) => x.menlei === m)?.n ?? 0;
  const d = detail.data;
  const catsInMenlei = grouped.data?.cats ?? [];
  const filteredCats = cat ? catsInMenlei.filter((c) => c.cat === cat) : catsInMenlei;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* 左侧：门类导航（掌上高考式） */}
      <aside className="w-full shrink-0 lg:w-52">
        <div className="paper-card sticky top-4 max-h-[70vh] overflow-y-auto p-3">
          <button
            type="button"
            onClick={() => pickMenlei("")}
            className={`mb-2 w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition ${
              !menlei ? "bg-brand text-cream" : "text-olive hover:bg-mint-pale/60"
            }`}
          >
            全部专业
            <span className="ml-1 text-[11px] opacity-70">{nav?.menleis.reduce((a, b) => a + b.n, 0) ?? 0}</span>
          </button>
          {FIELD_GROUPS.map((g) => (
            <div key={g.label} className="mb-2">
              <div className="px-2 py-1 text-[11px] font-bold text-olive-mute">{g.label}</div>
              {g.menleis.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => pickMenlei(m)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[12.5px] transition ${
                    menlei === m ? "bg-brand font-semibold text-cream" : "text-olive hover:bg-mint-pale/60"
                  }`}
                >
                  <span>{m}</span>
                  <span className="text-[11px] opacity-70">{navCount(m)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* 右侧：门类浏览 或 搜索表格 */}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            placeholder="搜索专业名称 / 代码 / 介绍"
            className="w-64 rounded-lg border border-border bg-cream px-3 py-2 text-[12.5px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime"
          />
          {isAdmin && (
            <span className="ml-auto">
              <ImportButton label="导入专业库 JSON" busy={imp.busy} onFile={(f) => imp.run(f, false)} />
            </span>
          )}
        </div>
        {imp.progress && <p className="text-[12px] text-olive-mute">{imp.progress}</p>}

        {searching ? (
          <>
            <p className="text-[12.5px] text-olive-mute">
              搜索「{keyword.trim()}」共 {query.data?.total ?? 0} 个专业
            </p>
            <MajorTable rows={query.data?.rows ?? []} loading={query.isLoading} empty={!query.isLoading && (query.data?.rows.length ?? 0) === 0} onOpen={setDetailId} />
            <Pager page={page} totalPages={totalPages} total={query.data?.total ?? 0} onChange={setPage} />
          </>
        ) : menlei ? (
          <>
            {/* 门类介绍横幅（不跳转，就地展开） */}
            <div className="paper-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-[18px] font-bold text-olive">{menlei}</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-olive-mute">{MENLEI_INTRO[menlei] ?? ""}</p>
                </div>
                <div className="text-right text-[12px] text-olive-mute">
                  <div><span className="text-[16px] font-bold text-olive">{grouped.data?.total ?? "…"}</span> 个专业</div>
                  <div><span className="text-[16px] font-bold text-olive">{catsInMenlei.length}</span> 个专业类</div>
                </div>
              </div>
              {catsInMenlei.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => setCat("")}
                    className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${!cat ? "border-transparent bg-brand text-white" : "border-border bg-cream-card text-olive hover:bg-mint-pale/60"}`}
                  >
                    全部专业类
                  </button>
                  {catsInMenlei.map((c) => (
                    <button
                      key={c.cat}
                      type="button"
                      onClick={() => setCat(c.cat === cat ? "" : c.cat)}
                      className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${cat === c.cat ? "border-transparent bg-brand text-white" : "border-border bg-cream-card text-olive hover:bg-mint-pale/60"}`}
                    >
                      {c.cat}<span className="ml-1 text-[10px] opacity-70">{c.majors.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* 专业类 → 专业卡片 */}
            {grouped.isLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
              </div>
            ) : (
              filteredCats.map((c) => (
                <div key={c.cat} className="paper-card p-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <h4 className="text-[14px] font-bold text-olive">{c.cat}</h4>
                    <span className="text-[11px] text-olive-mute">{c.majors.length} 个专业</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.majors.map((mj) => (
                      <button
                        key={mj.id}
                        type="button"
                        title={mj.oneLiner ?? mj.code}
                        onClick={() => setDetailId(mj.id)}
                        className="rounded-lg border border-border bg-cream px-2.5 py-1.5 text-left text-[12px] text-olive transition hover:border-lime hover:bg-mint-pale/50"
                      >
                        <span className="font-semibold">{mj.name}</span>
                        <span className="ml-1 font-mono text-[10.5px] text-olive-mute">{mj.code}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            <p className="text-[12.5px] text-olive-mute">从左侧选择一个学科门类开始浏览，或直接搜索专业名称。</p>
            <MajorTable rows={query.data?.rows ?? []} loading={query.isLoading} empty={!query.isLoading && (query.data?.rows.length ?? 0) === 0} onOpen={setDetailId} />
            <Pager page={page} totalPages={totalPages} total={query.data?.total ?? 0} onChange={setPage} />
          </>
        )}
      </div>

      {/* 专业详情弹窗 */}
      {detailId != null && d && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4" onClick={() => setDetailId(null)}>
          <div className="paper-card my-6 w-full max-w-3xl space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-bold text-olive">
                  {d.name}
                  <span className="ml-2 font-mono text-[12px] font-normal text-olive-mute">{d.code}</span>
                </h3>
                <p className="mt-1 text-[12.5px] text-olive-mute">
                  {d.menlei} · {d.cat} · {d.level}
                  {d.addedYear ? ` · ${d.addedYear} 年增设` : ""}
                </p>
              </div>
              <button onClick={() => setDetailId(null)} className="rounded-lg p-1.5 text-olive-mute hover:bg-cream" aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {MAJOR_FIELD_LABELS.map(([key, label]) => {
                const v = (d as unknown as Record<string, string | null>)[key];
                if (!v) return null;
                return (
                  <div key={key}>
                    <div className="text-[12px] font-bold text-olive">{label}</div>
                    <div className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-olive-mute">{v}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 搜索/全量模式的专业表格。 */
function MajorTable({
  rows,
  loading,
  empty,
  onOpen,
}: {
  rows: { id: number; code: string; name: string; menlei: string; cat: string; oneLiner: string | null }[];
  loading: boolean;
  empty: boolean;
  onOpen: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-border bg-cream/60 text-[11.5px] text-olive-mute">
            <th className="px-3 py-2 font-semibold">代码</th>
            <th className="px-3 py-2 font-semibold">专业名称</th>
            <th className="px-3 py-2 font-semibold">门类</th>
            <th className="px-3 py-2 font-semibold">专业类</th>
            <th className="px-3 py-2 font-semibold">一句话介绍</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-mint-pale/40">
              <td className="px-3 py-2 font-mono text-[11.5px] text-olive-mute">{r.code}</td>
              <td className="px-3 py-2 font-semibold text-olive">{r.name}</td>
              <td className="px-3 py-2 text-olive-mute">{r.menlei}</td>
              <td className="px-3 py-2 text-olive-mute">{r.cat}</td>
              <td className="max-w-[360px] truncate px-3 py-2 text-olive-mute">{r.oneLiner ?? "—"}</td>
            </tr>
          ))}
          {loading && <tr><td colSpan={5} className="px-3 py-8 text-center text-olive-mute">加载中…</td></tr>}
          {empty && <tr><td colSpan={5} className="px-3 py-8 text-center text-olive-mute">没有找到匹配的专业</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------- 职业库 ---------------------------------- */

function CareersTab({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [group, setGroup] = useState("");
  // 拉一大页推导一级分类列表（职业总量 < 200，一次拿全）
  const all = trpc.library.careers.useQuery({ page: 1, pageSize: 200 });
  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const c of all.data?.rows ?? []) {
      const g = c.category.split("·")[0]?.trim();
      if (g) set.add(g);
    }
    return [...set];
  }, [all.data]);
  const query = trpc.library.careers.useQuery(
    { page, pageSize: 12, keyword: keyword || undefined, category: group || undefined },
  );
  const rows = query.data?.rows ?? [];
  const utils = trpc.useUtils();
  const upsert = trpc.library.careersUpsert.useMutation({
    onSuccess: () => utils.library.careers.invalidate(),
  });
  const [editing, setEditing] = useState<Record<string, unknown> | "new" | null>(null);

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 12));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          placeholder="搜索职业名称 / 大类"
          className="w-56 rounded-lg border border-border bg-cream px-3 py-2 text-[12.5px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime"
        />
        <span className="text-[12px] text-olive-mute">{query.data?.total ?? 0} 个职业</span>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="ml-auto rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap text-cream hover:bg-lime"
          >
            + 新增职业
          </button>
        )}
      </div>
      {/* 学职平台式一级分类（参考 xz.chsi.com.cn/occupation） */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setGroup("")}
          className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${!group ? "border-transparent bg-brand text-white" : "border-border bg-cream-card text-olive hover:bg-mint-pale/60"}`}
        >
          全部
        </button>
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g === group ? "" : g)}
            className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${group === g ? "border-transparent bg-brand text-white" : "border-border bg-cream-card text-olive hover:bg-mint-pale/60"}`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => (
          <div key={c.id} className="paper-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-[14.5px] font-bold text-olive">{c.name}</h4>
                <p className="mt-0.5 text-[11.5px] text-olive-mute">{c.category || "—"}</p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setEditing(c as unknown as Record<string, unknown>)}
                  className="rounded-lg border border-border bg-cream-card px-2.5 py-1 text-[11.5px] text-olive hover:bg-mint-pale/60"
                >
                  编辑
                </button>
              )}
            </div>
            {c.content && <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-olive-mute">{c.content}</p>}
          </div>
        ))}
      </div>
      {rows.length === 0 && !query.isLoading && (
        <p className="py-8 text-center text-[12.5px] text-olive-mute">
          {isAdmin ? "还没有职业数据，点右上角新增" : "还没有职业数据"}
        </p>
      )}
      {!group && <Pager page={page} totalPages={totalPages} total={query.data?.total ?? 0} onChange={setPage} />}

      {editing && (
        <CareerEditModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            await upsert.mutateAsync(v as never);
            setEditing(null);
          }}
          busy={upsert.isPending}
        />
      )}
    </div>
  );
}

function CareerEditModal({
  initial,
  onClose,
  onSave,
  busy,
}: {
  initial: Record<string, unknown> | null;
  onClose: () => void;
  onSave: (v: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => ({
    id: initial?.id ? String(initial.id) : "",
    name: (initial?.name as string) ?? "",
    category: (initial?.category as string) ?? "",
    content: (initial?.content as string) ?? "",
    prospect: (initial?.prospect as string) ?? "",
    path: (initial?.path as string) ?? "",
    trend: (initial?.trend as string) ?? "",
    duties: JSON.stringify((initial?.duties as string[]) ?? []),
    skillsPro: JSON.stringify((initial?.skillsPro as string[]) ?? []),
    skillsGen: JSON.stringify((initial?.skillsGen as string[]) ?? []),
  }));
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const arr = (s: string) => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return s.split("\n").map((x) => x.trim()).filter(Boolean);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4" onClick={onClose}>
      <div className="paper-card my-6 w-full max-w-2xl space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-olive">{form.id ? "编辑职业" : "新增职业"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-olive-mute hover:bg-cream" aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="text-[12px] font-semibold text-olive">名称
            <input value={form.name} onChange={set("name")} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-1.5 text-[12.5px] outline-none focus:border-lime" />
          </label>
          <label className="text-[12px] font-semibold text-olive">大类
            <input value={form.category} onChange={set("category")} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-1.5 text-[12.5px] outline-none focus:border-lime" />
          </label>
        </div>
        {(
          [
            ["content", "职业内容", true],
            ["duties", "工作内容（JSON 数组或每行一条）", true],
            ["skillsPro", "专业技能（同上）", true],
            ["skillsGen", "通用技能（同上）", true],
            ["prospect", "发展前景", true],
            ["path", "发展路径", false],
            ["trend", "就业趋势", false],
          ] as const
        ).map(([k, label, area]) => (
          <label key={k} className="block text-[12px] font-semibold text-olive">
            {label}
            {area ? (
              <textarea value={form[k]} onChange={set(k)} rows={k === "content" ? 3 : 2}
                className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-1.5 text-[12.5px] outline-none focus:border-lime" />
            ) : (
              <input value={form[k]} onChange={set(k)}
                className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-1.5 text-[12.5px] outline-none focus:border-lime" />
            )}
          </label>
        ))}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg border border-border bg-cream-card px-4 py-2 text-[13px] text-olive">取消</button>
          <button
            disabled={busy || !form.name.trim()}
            onClick={() =>
              onSave({
                id: form.id ? Number(form.id) : undefined,
                name: form.name.trim(),
                category: form.category.trim(),
                content: form.content || undefined,
                duties: arr(form.duties),
                skillsPro: arr(form.skillsPro),
                skillsGen: arr(form.skillsGen),
                prospect: form.prospect || undefined,
                path: form.path || undefined,
                trend: form.trend || undefined,
              })
            }
            className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-cream hover:bg-lime disabled:opacity-40"
          >
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- 院校专业分数库 -------------------------------- */

function ScoresTab({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [minRank, setMinRank] = useState("");
  const [maxRank, setMaxRank] = useState("");
  const [sort, setSort] = useState<"est26" | "y1Min" | "y1Rank" | "y2Min" | "y3Min">("est26");
  const query = trpc.library.gdScores.useQuery(
    {
      page, pageSize: 20,
      school: school || undefined,
      major: major || undefined,
      minRank: minRank ? Number(minRank) : undefined,
      maxRank: maxRank ? Number(maxRank) : undefined,
      sort,
    },
  );
  const importMut = trpc.library.gdScoresImport.useMutation();
  const utils = trpc.useUtils();
  const [confirmClear, setConfirmClear] = useState(false);
  const imp = useJsonImport(async ({ rows, clear }) => {
    const r = await importMut.mutateAsync({ rows, clear });
    await utils.library.gdScores.invalidate();
    return r;
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 20));
  const rows = query.data?.rows ?? [];

  return (
    <div className="space-y-3">
      <div className="sticky top-[52px] z-20 -mx-1 flex flex-wrap items-center gap-2 bg-cream/95 px-1 py-2 backdrop-blur">
        <input value={school} onChange={(e) => { setSchool(e.target.value); setPage(1); }} placeholder="院校名称"
          className="w-44 rounded-lg border border-border bg-cream px-3 py-2 text-[12.5px] text-olive outline-none focus:border-lime" />
        <input value={major} onChange={(e) => { setMajor(e.target.value); setPage(1); }} placeholder="专业名称"
          className="w-44 rounded-lg border border-border bg-cream px-3 py-2 text-[12.5px] text-olive outline-none focus:border-lime" />
        <span className="text-[12px] text-olive-mute">预估位次</span>
        <input value={minRank} onChange={(e) => { setMinRank(e.target.value); setPage(1); }} placeholder="≥"
          className="w-24 rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime" />
        <span className="text-[12px] text-olive-mute">—</span>
        <input value={maxRank} onChange={(e) => { setMaxRank(e.target.value); setPage(1); }} placeholder="≤"
          className="w-24 rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime" />
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1); }}
          title="按所选年份的分数/位次从低到高排序"
          className="rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime"
        >
          <option value="est26">2026 预估位次 低→高</option>
          <option value="y1Min">2025 最低分 低→高</option>
          <option value="y1Rank">2025 最低位次 低→高</option>
          <option value="y2Min">2024 最低分 低→高</option>
          <option value="y3Min">2023 最低分 低→高</option>
        </select>
        <span className="text-[12px] text-olive-mute">{query.data?.total ?? 0} 条</span>
        <a
          href="/files/gd-2026-expert.xlsx"
          target="_blank"
          rel="noreferrer"
          title="在线打开广东-2026专家版数据 Excel 原件，可自由筛选查询"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-cream-card px-2.5 py-2 text-[12px] font-semibold text-olive hover:bg-mint-pale/60"
        >
          <FileSpreadsheet size={13} /> 数据原件（在线 Excel）
        </a>
        {isAdmin && (
          <span className="ml-auto flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-[12px] text-terra">首次导入将清空旧数据，确认？</span>
                <button type="button" onClick={() => { setConfirmClear(false); }}
                  className="rounded-lg border border-border bg-cream-card px-3 py-2 text-[12.5px] text-olive">取消</button>
                <ImportButton label="选文件并清空导入" busy={imp.busy} onFile={(f) => { setConfirmClear(false); imp.run(f, true); }} />
              </>
            ) : (
              <>
                <ImportButton label="导入分数 JSON（追加）" busy={imp.busy} onFile={(f) => imp.run(f, false)} />
                <button type="button" onClick={() => setConfirmClear(true)}
                  className="rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] text-olive hover:bg-mint-pale/60">
                  清空并重新导入
                </button>
              </>
            )}
          </span>
        )}
      </div>
      {imp.progress && <p className="text-[12px] text-olive-mute">{imp.progress}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-cream/60 text-[11.5px] text-olive-mute">
              <th className="px-3 py-2 font-semibold" rowSpan={2}>院校（专业组）</th>
              <th className="px-3 py-2 font-semibold" rowSpan={2}>2026 招生专业（学制/计划/学费）</th>
              <th className="px-3 py-2 font-semibold" rowSpan={2}>门类</th>
              <th className="px-3 py-2 font-semibold" rowSpan={2}>选科要求</th>
              <th className="px-3 py-2 font-semibold text-center" colSpan={5}>2025 年专业录取数据</th>
              <th className="px-3 py-2 font-semibold text-center" colSpan={5}>2024 年专业录取数据</th>
              <th className="px-3 py-2 font-semibold text-center" colSpan={5}>2023 年专业录取数据</th>
              <th className="px-3 py-2 font-semibold text-center" rowSpan={2}>26 预估位次</th>
            </tr>
            <tr className="border-b border-border bg-cream/60 text-[10.5px] text-olive-mute">
              {["2025", "2024", "2023"].map((y) => (
                <Fragment key={y}>
                  <th className="px-1.5 py-1.5 text-right font-semibold">人数</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold">最低分</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold">最低位次</th>
                  <th className="px-1.5 py-1.5 font-semibold">批次</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold">计划</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-mint-pale/40">
                <td className="px-3 py-2 font-semibold whitespace-nowrap text-olive">{r.school}<div className="text-[11px] font-normal text-olive-mute">{r.groupName}</div></td>
                <td className="max-w-[280px] px-3 py-2 text-olive">{r.majorFull || r.major}<div className="text-[11px] whitespace-nowrap text-olive-mute">{r.years}年制 · 计划{r.plan ?? "—"} · {r.fee || "学费—"}</div></td>
                <td className="px-3 py-2 whitespace-nowrap text-olive-mute">{r.menlei}</td>
                <td className="px-3 py-2 whitespace-nowrap text-olive-mute">{r.req || "不限"}</td>
                <YearCells y={{ count: r.y1Count, min: r.y1Min, rank: r.y1Rank, batch: r.y1Batch, plan: r.y1Plan }} hl={sort === "y1Min" || sort === "y1Rank"} />
                <YearCells y={{ count: r.y2Count, min: r.y2Min, rank: r.y2Rank, batch: r.y2Batch, plan: r.y2Plan }} hl={sort === "y2Min"} />
                <YearCells y={{ count: r.y3Count, min: r.y3Min, rank: r.y3Rank, batch: r.y3Batch, plan: r.y3Plan }} hl={sort === "y3Min"} />
                <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${sort === "est26" ? "text-brand" : "text-olive"}`}>{r.estRank26 ?? "—"}</td>
              </tr>
            ))}
            {query.isLoading && <tr><td colSpan={21} className="px-3 py-8 text-center text-olive-mute">加载中…</td></tr>}
            {!query.isLoading && rows.length === 0 && (
              <tr><td colSpan={21} className="px-3 py-8 text-center text-olive-mute">
                {isAdmin ? "库里还没有数据，点右上角导入分数 JSON" : "库里还没有数据，请联系管理员导入"}
              </td></tr>
            )}
          </tbody>
        </table>
        <Pager page={page} totalPages={totalPages} total={query.data?.total ?? 0} onChange={setPage} />
      </div>
    </div>
  );
}

/** 分数库三年明细单元格（每年：人数/最低分/位次/批次/计划）。 */
function YearCells({ y, hl }: { y: { count: number | null; min: number | null; rank: number | null; batch: string; plan: number | null }; hl: boolean }) {
  const cell = `px-1.5 py-2 text-right text-[11.5px] whitespace-nowrap ${hl ? "font-semibold text-brand" : "text-olive-mute"}`;
  return (
    <>
      <td className={cell}>{y.count ?? "—"}</td>
      <td className={cell}>{y.min ?? "—"}</td>
      <td className={cell}>{y.rank ?? "—"}</td>
      <td className="px-1.5 py-2 text-[11px] whitespace-nowrap text-olive-mute">{y.batch || "—"}</td>
      <td className={cell}>{y.plan ?? "—"}</td>
    </>
  );
}

/* ---------------------------------- 查大学 ---------------------------------- */

const UNI_FIELD_LABELS: [key: string, label: string][] = [
  ["intro", "院校简介"],
  ["introShort", "简介摘要"],
  ["supervisor", "主管部门"],
  ["foundYear", "建校时间"],
  ["area", "占地面积"],
  ["alias", "简称"],
  ["formerNames", "曾用名"],
  ["motto", "校训"],
  ["ranking", "平台排名"],
  ["subjectEval", "学科评估等级数量"],
  ["academicians", "院士数量"],
  ["libraryBooks", "图书馆藏书"],
  ["labs", "实验室数量"],
  ["baoyan", "保研比例"],
  ["doctor", "博士点"],
  ["doctorDetail", "博士点明细"],
  ["master", "硕士点"],
  ["masterDetail", "硕士点明细"],
  ["keyDisciplines", "国家重点学科"],
  ["dfc", "双一流建设学科"],
  ["departments", "院系设置（含专业）"],
  ["campus", "校园配置"],
  ["dorm", "宿舍介绍"],
  ["canteen", "食堂介绍"],
  ["scholarship", "奖学金设置"],
  ["aid", "困难生资助"],
  ["malePct", "男生比例"],
  ["femalePct", "女生比例"],
  ["history", "历史沿革"],
  ["address", "学校地址"],
  ["zsPhone", "招生电话"],
  ["zsWebsite", "招生官网"],
  ["website", "学校官网"],
];

function UniversitiesTab({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [province, setProvince] = useState("");
  const [keyword, setKeyword] = useState("");
  const [level, setLevel] = useState("");
  const [nature, setNature] = useState("");
  const [tag, setTag] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: provinces } = trpc.library.universityProvinces.useQuery();
  const query = trpc.library.universities.useQuery(
    {
      page, pageSize: 15,
      province: province || undefined,
      keyword: keyword || undefined,
      level: level || undefined,
      nature: nature || undefined,
      tag: tag || undefined,
    },
  );
  const detail = trpc.library.university.useQuery(
    { id: detailId ?? 0 },
    { enabled: detailId != null },
  );
  const importMut = trpc.library.universitiesImport.useMutation();
  const utils = trpc.useUtils();
  const [confirmClear, setConfirmClear] = useState(false);
  const imp = useJsonImport(async ({ rows, clear }) => {
    const r = await importMut.mutateAsync({ rows, clear });
    await utils.library.universities.invalidate();
    await utils.library.universityProvinces.invalidate();
    return r;
  }, 300);

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 15));
  const rows = query.data?.rows ?? [];
  const d = detail.data;

  return (
    <div className="space-y-3">
      {/* 省份归类导航（参考掌上高考查大学） */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => { setProvince(""); setPage(1); }}
          className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
            !province ? "border-transparent bg-brand text-white" : "border-border bg-cream-card text-olive hover:bg-mint-pale/60"
          }`}
        >
          全部
        </button>
        {(provinces ?? []).map((p) => (
          <button
            key={p.province}
            type="button"
            onClick={() => { setProvince(p.province === province ? "" : p.province); setPage(1); }}
            className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
              province === p.province ? "border-transparent bg-brand text-white" : "border-border bg-cream-card text-olive hover:bg-mint-pale/60"
            }`}
          >
            {p.province}
            <span className="ml-1 text-[10px] opacity-70">{p.n}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} placeholder="搜索校名 / 简称 / 城市"
          className="w-52 rounded-lg border border-border bg-cream px-3 py-2 text-[12.5px] text-olive outline-none focus:border-lime" />
        <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime">
          <option value="">全部层次</option>
          <option value="本科">本科</option>
          <option value="专科">专科</option>
        </select>
        <select value={nature} onChange={(e) => { setNature(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime">
          <option value="">全部性质</option>
          <option value="公办">公办</option>
          <option value="民办">民办</option>
          <option value="中外合作办学">中外合作办学</option>
          <option value="内地与港澳台合作办学">内地与港澳台合作办学</option>
        </select>
        <select value={tag} onChange={(e) => { setTag(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime">
          <option value="">全部标签</option>
          <option value="985">985</option>
          <option value="211">211</option>
          <option value="双一流">双一流</option>
        </select>
        <span className="text-[12px] text-olive-mute">{query.data?.total ?? 0} 所</span>
        {isAdmin && (
          <span className="ml-auto flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-[12px] text-terra">首次导入将清空旧数据，确认？</span>
                <button type="button" onClick={() => setConfirmClear(false)}
                  className="rounded-lg border border-border bg-cream-card px-3 py-2 text-[12.5px] text-olive">取消</button>
                <ImportButton label="选文件并清空导入" busy={imp.busy} onFile={(f) => { setConfirmClear(false); imp.run(f, true); }} />
              </>
            ) : (
              <>
                <ImportButton label="导入院校库 JSON（追加）" busy={imp.busy} onFile={(f) => imp.run(f, false)} />
                <button type="button" onClick={() => setConfirmClear(true)}
                  className="rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] text-olive hover:bg-mint-pale/60">
                  清空并重新导入
                </button>
              </>
            )}
          </span>
        )}
      </div>
      {imp.progress && <p className="text-[12px] text-olive-mute">{imp.progress}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((u) => (
          <div
            key={u.id}
            role="button"
            tabIndex={0}
            onClick={() => u.detailUrl && window.open(u.detailUrl, "_blank", "noopener")}
            onKeyDown={(e) => { if (e.key === "Enter" && u.detailUrl) window.open(u.detailUrl, "_blank", "noopener"); }}
            title={u.detailUrl ? "打开掌上高考院校详情页" : undefined}
            className="paper-card relative flex cursor-pointer items-start gap-3 p-4 text-left transition-shadow hover:shadow-md"
          >
            {u.logoUrl ? (
              <img src={u.logoUrl} alt="" className="mt-0.5 h-11 w-11 rounded-lg border border-border object-contain" loading="lazy" />
            ) : (
              <School size={26} className="mt-1 shrink-0 text-olive-mute" />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[14px] font-bold text-olive">{u.name}</span>
              </span>
              <span className="mt-0.5 block text-[11.5px] text-olive-mute">
                {u.province} · {u.city} · {u.schoolType || "综合"} · {u.nature}
              </span>
              {u.tags && (
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {u.tags.split("；").filter(Boolean).slice(0, 4).map((t) => (
                    <span key={t} className="rounded-full bg-mint-pale px-2 py-0.5 text-[10.5px] font-semibold text-olive">{t}</span>
                  ))}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setDetailId(u.id); }}
              title="查看库内详情（测评调用数据）"
              className="absolute right-2.5 top-2.5 rounded-md p-1 text-olive-mute/60 transition hover:bg-mint-pale/60 hover:text-olive"
            >
              <Info size={14} />
            </button>
          </div>
        ))}
      </div>
      {rows.length === 0 && !query.isLoading && (
        <p className="py-8 text-center text-[12.5px] text-olive-mute">
          {isAdmin ? "库里还没有数据，点右上角导入院校库 JSON（掌上高考院校基础信息总表）" : "库里还没有数据，请联系管理员导入"}
        </p>
      )}
      <Pager page={page} totalPages={totalPages} total={query.data?.total ?? 0} onChange={setPage} />

      {detailId != null && d && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4" onClick={() => setDetailId(null)}>
          <div className="paper-card my-6 w-full max-w-3xl space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              {d.logoUrl && <img src={d.logoUrl} alt="" className="h-14 w-14 rounded-xl border border-border object-contain" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[18px] font-bold text-olive">{d.name}</h3>
                  <button onClick={() => setDetailId(null)} className="rounded-lg p-1.5 text-olive-mute hover:bg-cream" aria-label="关闭">
                    <X size={18} />
                  </button>
                </div>
                <p className="mt-1 text-[12.5px] text-olive-mute">
                  {d.province} · {d.city} · {d.schoolType || "院校"} · {d.nature}
                  {d.foundYear ? ` · 建于${d.foundYear}` : ""}
                  {d.supervisor ? ` · 主管部门：${d.supervisor}` : ""}
                </p>
                {d.tags && (
                  <p className="mt-1.5 flex flex-wrap gap-1">
                    {d.tags.split("；").filter(Boolean).map((t) => (
                      <span key={t} className="rounded-full bg-mint-pale px-2 py-0.5 text-[10.5px] font-semibold text-olive">{t}</span>
                    ))}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-3">
              {UNI_FIELD_LABELS.map(([key, label]) => {
                const v = (d as unknown as Record<string, string | null>)[key];
                if (!v) return null;
                return (
                  <div key={key}>
                    <div className="text-[12px] font-bold text-olive">{label}</div>
                    <div className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-olive-mute">{v}</div>
                  </div>
                );
              })}
            </div>
            {d.detailUrl && (
              <a href={d.detailUrl} target="_blank" rel="noreferrer"
                className="inline-block rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[12.5px] text-olive hover:bg-mint-pale/60">
                查看掌上高考详情页 ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- 12 学科门类（就地展开介绍） -------------------------------- */

/** 门类图 + 门类介绍就地展开：点大类看介绍，不跳转。 */
function DisciplinesPanel({ onBrowse }: { onBrowse: (menlei: string) => void }) {
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (m: string) => setOpen((o) => (o.includes(m) ? o.filter((x) => x !== m) : [...o, m]));
  return (
    <div className="space-y-4">
      <div className="paper-card p-5">
        <DisciplineTreeChart />
      </div>
      <div className="paper-card p-5">
        <h3 className="text-[15px] font-bold text-olive">12 大学科门类详细介绍</h3>
        <p className="mt-0.5 text-[12px] text-olive-mute">点门类名就地展开介绍（不跳转），也可直接查看该门类下的全部专业。</p>
        <div className="mt-3 space-y-3">
          {FIELD_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-brand px-2 py-0.5 text-[11.5px] font-bold text-cream">{g.label}</span>
                <span className="text-[11px] text-olive-mute">{g.sub}</span>
                <div className="h-px flex-1 bg-brand/10" />
              </div>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {g.menleis.map((m) => {
                  const opened = open.includes(m);
                  return (
                    <div key={m} className="rounded-xl border border-olive/12 bg-cream/60 p-3">
                      <button type="button" onClick={() => toggle(m)} className="flex w-full items-center justify-between text-left">
                        <span className="text-[13.5px] font-bold text-olive">{m}</span>
                        <span className="text-[11px] font-semibold text-brand">{opened ? "收起 ∧" : "展开介绍 ∨"}</span>
                      </button>
                      {opened && (
                        <div className="mt-2 border-t border-border pt-2">
                          <p className="text-[12px] leading-relaxed text-olive-mute">{MENLEI_INTRO[m]}</p>
                          <button
                            type="button"
                            onClick={() => onBrowse(m)}
                            className="mt-2 rounded-lg bg-brand px-2.5 py-1 text-[11.5px] font-semibold text-cream hover:bg-lime"
                          >
                            查看{m}全部专业 →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- 页面主体 ---------------------------------- */

export default function Library() {
  const { user } = useAuth();
  const allowed = user?.role === "tutor" || user?.role === "admin";
  const [tab, setTab] = useState<TabKey>("majors");
  const [menleiFromTree, setMenleiFromTree] = useState("");
  const isAdmin = user?.role === "admin";

  if (!allowed) {
    return (
      <div className="mx-auto mt-16 max-w-md">
        <div className="paper-card p-8 text-center">
          <BookOpen className="mx-auto text-olive" size={34} />
          <h1 className="mt-3 text-[19px] font-bold text-olive">三好生涯 · 资料库</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-mute">
            专业底层库、职业库、院校专业分数库仅供伴学师与管理员查询，需要相应权限。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-olive">三好生涯 · 资料库</h1>
        <p className="mt-1 text-[13px] text-olive-mute">
          专业底层库（天生智慧 1152+ 专业）、职业库、广东院校专业分数库与 12 学科门类图，供咨询与报告生成时查询调用。
        </p>
        <div className="sticky top-0 z-30 -mx-1 mt-3 bg-cream/95 px-1 py-1.5 backdrop-blur">
          <div className="flex rounded-xl border border-[#1E3530]/10 bg-white p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold transition ${
                  tab === t.key ? "bg-[#0C7064] text-white shadow" : "text-[#1E3530] hover:bg-[#0C7064]/10"
                }`}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      {tab === "majors" && <MajorsTab isAdmin={isAdmin} initialMenlei={menleiFromTree} />}
      {tab === "universities" && <UniversitiesTab isAdmin={isAdmin} />}
      {tab === "careers" && <CareersTab isAdmin={isAdmin} />}
      {tab === "scores" && <ScoresTab isAdmin={isAdmin} />}
      {tab === "disciplines" && <DisciplinesPanel onBrowse={(m) => { setTab("majors"); setMenleiFromTree(m); }} />}
    </div>
  );
}
