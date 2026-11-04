/**
 * 家庭教育报告（v236）· 学生端 / 伴学师端共用的报告页。
 *
 * 只做一件事：把 `assessment.family` 取到的三个层次摆成人能看懂的六块——
 * 结论、五级台阶、盲区、安全感、冲突场景、下一步。
 *
 * 三条硬口径（与 contracts/familyProfile.ts 一致，改文案时别破坏）：
 * 1. 台阶取低：孩子说通、家长说断，按断算；单方作答标「单方」，不当成结论用。
 * 2. 不贴类型名：不写「专制型」「权威型」，只写要求与回应两个分，以及那句人话。
 * 3. 0—10 打分只给咨询师看：报告里不印孩子给父母的分数。
 */
import { Link, useLocation, useNavigate } from "react-router";
import type { ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import { useAssessmentPass } from "@/components/coach/passRequest";
import type { LadderMerge, FamilyProfile } from "@contracts/familyProfile";
import type { FamilyStudentProfile } from "@contracts/familyStudent";

const LEVEL_TEXT: Record<string, string> = {
  L1: "遇到麻烦，第一个找爸妈",
  L2: "心里的事，愿意跟爸妈说",
  L3: "吵完还能主动开口",
  L4: "家里的规矩可以商量",
  L5: "自己的事大部分自己定",
};

const BAND_STYLE: Record<string, { bg: string; fg: string; text: string }> = {
  断: { bg: "rgba(178,90,60,.12)", fg: "#9E4A2C", text: "这条路上已经没人走了" },
  勉强: { bg: "rgba(199,127,42,.14)", fg: "#8A5A16", text: "门还开着，但推得很费力" },
  通: { bg: "rgba(120,150,60,.16)", fg: "#5C7024", text: "能走通，只是不常走" },
  稳: { bg: "rgba(12,112,100,.14)", fg: "#0C7064", text: "走得稳，是你们的底子" },
  未测: { bg: "#F1F2ED", fg: "#8A8F78", text: "这次没答到这一级" },
};

const SCENE_LABEL: Record<string, string> = {
  phone: "手机",
  homework: "作业拖延",
  score: "成绩",
  sleep: "作息",
  friend: "交友",
  privacy: "隐私（关门、翻手机）",
};

export default function FamilyReport({
  viewer = "student",
  studentId,
}: {
  viewer?: "student" | "tutor";
  /** 伴学师查看学员时传学员 userId；学生看自己不用传。 */
  studentId?: number;
}) {
  const { data, isLoading } = trpc.assessment.family.useQuery(
    studentId != null ? { userId: studentId } : undefined,
    { retry: false },
  );

  if (isLoading) return <div className="paper-card h-40 animate-pulse bg-cream-deep/50" />;

  const student = data?.student ?? null;
  const hasParent = !!data?.parent;

  if (!student && !hasParent) {
    return (
      <div className="paper-card p-8 text-center">
        <p className="text-[15px] font-semibold text-olive">还没有家庭关系测评的数据</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-olive-mute">
          这份报告需要两份问卷：孩子一份（学生卷 14 题），家长一份（家长卷 29 题）。
          两边都答完，才能看出「你以为的」和「他实际答的」差在哪里。
        </p>
        {viewer === "tutor" ? (
          <>
            {/* 伴学师点这里不是「我要去答」，而是「把卷递出去」：出码，孩子或家长扫 */}
            <PassStartButton />
            <p className="mt-2 text-[11.5px] leading-relaxed text-olive-mute">
              孩子扫：用他自己的账号答完，直接进这份报告。家长扫：不用注册，答案落到这个孩子名下。
            </p>
          </>
        ) : (
          <Link
            to="/assessments?start=familystudent"
            className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-cream no-underline hover:bg-lime"
          >
            去做家庭关系测评
          </Link>
        )}
      </div>
    );
  }

  return (
    <FamilyReportBody
      student={student}
      merged={data?.merged ?? null}
      hasParent={hasParent}
      parentCount={data?.parents?.length ?? 0}
    />
  );
}

/**
 * 报告的呈现层。与取数分离，是为了能直接拿案例数据渲染做冒烟——
 * 报告文案的回归靠这个，不靠起一套数据库。
 */
export function FamilyReportBody({
  student,
  merged,
  hasParent,
  parentCount,
}: {
  student: FamilyStudentProfile | null;
  merged: FamilyProfile | null;
  hasParent: boolean;
  /** 收到几份家长卷（爸爸、妈妈各一份则为 2）：锦囊的「父母版」靠这个判断够不够 */
  parentCount?: number;
}) {
  void parentCount;
  return (
    <div className="space-y-4">
      <Conclusion merged={merged} student={student} hasParent={hasParent} />
      <Ladder merged={merged} />
      {student && <BlindSpots merged={merged} />}
      {student && <Security student={student} />}
      <Scene merged={merged} hasParent={hasParent} />
      <NextSteps merged={merged} student={student} />
      <CommKitEntry />
      <p className="px-1 text-[11.5px] leading-relaxed text-olive-mute">
        这份报告只描述「现在这段关系的样子」，不评价任何一方。台阶与盲区的数字来自本次作答，
        孩子给父母的 0—10 打分不对家长展示，仅咨询师可见。
      </p>
    </div>
  );
}

/**
 * 沟通锦囊已独立成一份报告（v240），和本报告并列。
 * 这里只留一个入口：诊断说「哪一级走不通」，锦囊说「第一句话怎么说」——
 * 两件事分开写，才不会在同一页里出现两种口径。
 */
function CommKitEntry() {
  const navigate = useNavigate();
  const loc = useLocation();
  return (
    <section className="paper-card p-5">
      <h3 className="text-[16px] font-bold text-olive">下一步：第一句话怎么说</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-olive-soft">
        这一份讲的是「现在这段关系是什么样」。真要开口，去看《家庭沟通锦囊》——
        它按每个人 DISC 的主导与副维写，分家长家庭综合版、学生家庭综合版、学生个人版、
        家长个人版四本，各带封面、各能单独打印，每一句都能照着念。
      </p>
      <button
        onClick={() => {
          const q = new URLSearchParams(loc.search);
          q.set("tab", "commkit");
          navigate(`${loc.pathname}?${q.toString()}`);
        }}
        className="mt-3 rounded-xl bg-brand px-4 py-2 text-[13px] font-semibold text-cream hover:bg-lime"
      >
        去看家庭沟通锦囊
      </button>
    </section>
  );
}

/** 伴学师视角的「去做家庭关系测评」：出码，而不是把人送去孩子的页面。 */
function PassStartButton() {
  const openPass = useAssessmentPass();
  return (
    <button
      onClick={() => openPass?.("familystudent")}
      className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-lime"
    >
      去做家庭关系测评
    </button>
  );
}

/* ------------------------------------------------------------------ */

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="paper-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[16px] font-bold text-olive">{title}</h3>
        {note && <span className="text-[11.5px] text-olive-mute">{note}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Conclusion({
  merged,
  student,
  hasParent,
}: {
  merged: FamilyProfile | null;
  student: FamilyStudentProfile | null;
  hasParent: boolean;
}) {
  const pair = !!merged && hasParent;
  const broken = merged?.ladder.filter((l) => l.band === "断") ?? [];
  const shaky = merged?.ladder.filter((l) => l.band === "勉强") ?? [];

  const headline = !student
    ? "这一份是家长自己填的，等孩子那份答完，才能做对照"
    : !pair
      ? "孩子这份已经答完，家长那份还没填——先看他自己怎么说"
      : broken.length
        ? `断了 ${broken.length} 级：${broken.map((b) => b.level).join("、")}`
        : shaky.length
          ? `没有断掉的，但 ${shaky.map((s) => s.level).join("、")} 是勉强的`
          : "五级都是通的";

  return (
    <section className="paper-card accent-l border-lime p-5">
      <p className="mono text-[11px] tracking-wider text-olive-mute">家庭教育认知报告</p>
      <h2 className="mt-1 text-[19px] font-bold leading-snug text-olive">{headline}</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
        {pair && merged
          ? merged.branch.reason
          : student
            ? "五级台阶讲的是「你和爸妈之间的路，哪一级走不通」。断掉的那一级，不是谁不爱谁，是那件事上他不再指望你们。"
            : "家长这份问卷记录的是你的管教方式与投入。等孩子那份答完，系统会告诉你哪几项你估得准、哪几项估偏了。"}
      </p>
      {pair && merged && merged.branch.branch !== "repair" && (
        <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-[12.5px] leading-relaxed text-olive-soft">
          他的底子是好的——这决定了这份报告的重点不是「补窟窿」，而是「把已经通的那几级加固住」。
        </p>
      )}
    </section>
  );
}

function Ladder({ merged }: { merged: FamilyProfile | null }) {
  if (!merged) {
    return (
      <Card title="五级台阶" note="需要两份问卷">
        <p className="text-[13px] leading-relaxed text-olive-mute">
          台阶要「孩子说」和「家长说」两条线合起来看才有意义：孩子说通、家长说断，按断算。缺一份就先不下结论。
        </p>
      </Card>
    );
  }
  return (
    <Card title="五级台阶 · 哪一级走不通" note="取孩子与家长中较低的一方判定">
      <div className="space-y-2">
        {merged.ladder.map((l) => (
          <LadderRow key={l.level} l={l} />
        ))}
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-olive-mute">
        单方判断（只有一边作答）仅供参考，不作结论；两边差 1.5 分以上标「看法不同」，说明这一级你们感受不一样。
      </p>
    </Card>
  );
}

function LadderRow({ l }: { l: LadderMerge }) {
  const s = BAND_STYLE[l.band] ?? BAND_STYLE.未测;
  return (
    <div className="rounded-xl border border-border/70 bg-cream px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-[11.5px] text-olive-mute">{l.level}</span>
        <span className="min-w-0 flex-1 text-[13.5px] text-olive">{LEVEL_TEXT[l.level]}</span>
        <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: s.bg, color: s.fg }}>
          {l.band}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-olive-mute">
        <span>孩子 {l.student ? `${l.student} 分` : "未答"}</span>
        <span>家长 {l.parent ? `${l.parent} 分` : "未答"}</span>
        <span style={{ color: s.fg }}>{s.text}</span>
        {l.singleSide && <span className="rounded bg-cream-deep px-1.5 py-px">单方判断</span>}
        {l.diverged && <span className="rounded bg-butter-pale px-1.5 py-px text-[#8A5A16]">看法不同</span>}
      </div>
    </div>
  );
}

function BlindSpots({ merged }: { merged: FamilyProfile | null }) {
  const blind = merged?.blind ?? [];
  if (!blind.length) {
    return (
      <Card title="六项盲区对照" note="家长猜的 vs 孩子答的">
        <p className="text-[13px] leading-relaxed text-olive-mute">
          还没法配对——需要家长那份里的「情感对照」六题，和孩子这六题一一对上才算得出来。
        </p>
      </Card>
    );
  }
  const hits = blind.filter((b) => b.blind);
  return (
    <Card title="六项盲区对照" note={`${blind.length} 项可对照 · ${hits.length} 项偏差 ≥1.5`}>
      <div className="space-y-1.5">
        {blind.map((b) => (
          <div
            key={b.key}
            className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: b.blind ? "rgba(199,127,42,.10)" : "#FAFBF8" }}
          >
            <span className="min-w-0 flex-1 text-[13px] text-olive">{b.label}</span>
            <span className="mono text-[11.5px] text-olive-mute">
              家长 {b.parentScore} / 孩子 {b.studentScore}
            </span>
            <span className="text-[11.5px]" style={{ color: b.blind ? "#8A5A16" : "#8A8F78" }}>
              {b.blind ? (b.gap > 0 ? `高估 ${b.gap.toFixed(1)}` : `低估 ${Math.abs(b.gap).toFixed(1)}`) : "基本一致"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-olive-mute">
        「高估」= 你以为他更愿意，实际不是；「低估」= 他比你估的更靠你。偏差 ≥1.5 的这几项，就是最容易白吵的地方。
      </p>
    </Card>
  );
}

function Security({ student }: { student: FamilyStudentProfile }) {
  const { needConfirm, fearProbe, needConfirmScore, fearProbeScore } = student.security;
  const higher = needConfirmScore >= fearProbeScore ? "怕他们担心" : "难受时躲起来";
  return (
    <Card title="安全感 · 他是怎么保护自己的" note="这两维只看倾向，不折成分数">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-cream px-3 py-2.5">
          <div className="text-[12px] text-olive-mute">怕他们担心（需确认）</div>
          <div className="mt-0.5 text-[15px] font-bold text-olive">{needConfirm}</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-olive-mute">
            「没回消息是不是我做错了」——需要被明确确认，才敢放心。
          </p>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2.5">
          <div className="text-[12px] text-olive-mute">难受时躲起来（怕追问）</div>
          <div className="mt-0.5 text-[15px] font-bold text-olive">{fearProbe}</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-olive-mute">
            「越问越躲」——不是不想说，是一开口就要解释很多。
          </p>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-olive-soft">
        偏高的是「{higher}」。这一类孩子要的不是更多的关心，是更确定的回应：说清楚什么时候回、说清楚不是他的错。
      </p>
    </Card>
  );
}

function Scene({ merged, hasParent }: { merged: FamilyProfile | null; hasParent: boolean }) {
  if (!merged) return null;
  const s = merged.scene.student ? SCENE_LABEL[merged.scene.student] ?? merged.scene.student : null;
  const p = merged.scene.parent ? SCENE_LABEL[merged.scene.parent] ?? merged.scene.parent : null;
  if (!s && !p) return null;
  return (
    <Card title="最容易吵起来的那件事" note="两边各选一件">
      <div className="flex flex-wrap gap-2 text-[13.5px]">
        <span className="rounded-xl bg-cream px-3 py-2 text-olive">孩子选：{s ?? "未答"}</span>
        <span className="rounded-xl bg-cream px-3 py-2 text-olive">家长选：{p ?? "未答"}</span>
        {hasParent && (
          <span
            className="rounded-xl px-3 py-2 font-semibold"
            style={{
              background: merged.scene.match ? "rgba(120,150,60,.16)" : "rgba(178,90,60,.12)",
              color: merged.scene.match ? "#5C7024" : "#9E4A2C",
            }}
          >
            {merged.scene.match ? "是同一件事" : "不是同一件事"}
          </span>
        )}
      </div>
      {!!p && !merged.scene.match && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-olive-soft">
          这一点比分数更值得注意：家里最常吵的不是同一件事，说明每次冲突你们其实在解决两个问题——
          他躲的那件事和你在意的那件事。先把「到底在吵什么」说成一句双方都认的话，再谈怎么办。
        </p>
      )}
    </Card>
  );
}

function NextSteps({ merged, student }: { merged: FamilyProfile | null; student: FamilyStudentProfile | null }) {
  const steps: string[] = [];
  if (merged) {
    const broken = merged.ladder.find((l) => l.band === "断" || l.band === "勉强");
    if (broken) steps.push(`只修一级：先修 ${broken.level}「${LEVEL_TEXT[broken.level]}」，其他先放下。一级修通，下一级才好谈。`);
  }
  if (merged && merged.blind.some((b) => b.blind)) {
    const top = [...merged.blind].filter((b) => b.blind).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];
    steps.push(`把「${top.label}」这件事当面对一次：先说你观察到什么，再说你怎么想，最后问他一句「我猜得对吗」。`);
  }
  if (student && student.security.fearProbe !== "低") {
    steps.push("难受的时候不要追着问。改成一句：「我不问了，你想说的时候我在。」然后真的不问。");
  }
  steps.push("九十天只练一件事：好好说话。吵架时先把声音降下来，比讲道理有用得多。");

  return (
    <Card title="接下来九十天，只做这几件" note="一次只练一件，别全做">
      <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-olive">
        {steps.slice(0, 4).map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
    </Card>
  );
}
