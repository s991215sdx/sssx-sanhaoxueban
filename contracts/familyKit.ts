/**
 * 家庭沟通锦囊（v239）
 *
 * 报告回答「现在是什么样」，锦囊回答「今晚回家第一句话说什么」。
 * 两者必须分开：报告里的判断要保守（单方不作结论、不贴类型名），
 * 锦囊里的建议要具体（能照念、能今晚就用、做完能判断有没有用）。
 *
 * 四个版本对应四种"谁在看"：
 *  - student  孩子本人：自己想改哪一级、第一句话怎么说、吵起来怎么退；
 *  - parent   家长本人：你以为的和他答的差在哪、怎么问才不像审问；
 *  - parents  爸爸和妈妈一起：口径怎么对齐、谁去谈、两人判断不一样时怎么办；
 *  - children 孩子看这个家：爸妈不一样是怎么回事、家里不止一个孩子时怎么自处。
 *
 * 所有内容从本次作答推导，不写"通用建议"。数据缺一块，就少说一块，
 * 不拿套话填满——家长一眼能看出哪句是印好的、哪句是说他家的。
 */
import type { FamilyProfile, LadderMerge } from "./familyProfile";
import type { FamilyStudentProfile } from "./familyStudent";

export type KitView = "student" | "parent" | "parents" | "children";

export type KitBlock = { h: string; lines: string[] };

export type KitPart = {
  key: KitView;
  /** 卡片上的短名 */
  label: string;
  /** 一句「这一份是给谁看的」 */
  forWhom: string;
  headline: string;
  blocks: KitBlock[];
  /** 可以直接照念的话，最多三句 */
  say: string[];
  /** 别说的，最多三条 */
  avoid: string[];
  /** 数据够不够支撑这一份；不够就照实说，不硬编 */
  ready: boolean;
  /** ready=false 时显示的原因 */
  missing?: string;
};

const LEVEL_TEXT: Record<string, string> = {
  L1: "遇到麻烦，第一个找爸妈",
  L2: "心里的事，愿意跟爸妈说",
  L3: "吵完还能主动开口",
  L4: "家里的规矩可以商量",
  L5: "自己的事大部分自己定",
};

const SCENE_TEXT: Record<string, string> = {
  phone: "手机",
  homework: "作业拖延",
  score: "成绩",
  sleep: "作息",
  friend: "交友",
  privacy: "隐私（关门、翻手机）",
};

/** 台阶里最值得先动的那一级：断优先，其次勉强；都通则取最弱的一级。 */
function pickLevel(ladder: LadderMerge[] | undefined): LadderMerge | null {
  if (!ladder?.length) return null;
  const scored = ladder.filter((l) => l.band !== "未测");
  if (!scored.length) return null;
  return (
    scored.find((l) => l.band === "断") ??
    scored.find((l) => l.band === "勉强") ??
    [...scored].sort((a, b) => Math.min(a.student || 9, a.parent || 9) - Math.min(b.student || 9, b.parent || 9))[0]
  );
}

/** 偏差最大的那一项盲区。 */
function pickBlind(merged: FamilyProfile | null): FamilyProfile["blind"][number] | null {
  const list = (merged?.blind ?? []).filter((b) => b.blind);
  if (!list.length) return null;
  return [...list].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];
}

export function buildFamilyKit({
  merged,
  student,
  hasParent,
  parentCount = hasParent ? 1 : 0,
}: {
  merged: FamilyProfile | null;
  student: FamilyStudentProfile | null;
  hasParent: boolean;
  /** 收到几份家长卷（爸爸、妈妈各一份则为 2） */
  parentCount?: number;
}): KitPart[] {
  const level = pickLevel(merged?.ladder);
  const levelName = level ? `${level.level}「${LEVEL_TEXT[level.level]}」` : null;
  const blind = pickBlind(merged);
  const sceneKey = merged?.scene.student ?? student?.scene ?? null;
  const sceneName = sceneKey ? SCENE_TEXT[sceneKey] ?? sceneKey : null;
  const mismatch = !!merged?.scene.parent && !merged.scene.match;
  const parentScene = merged?.scene.parent ? SCENE_TEXT[merged.scene.parent] ?? merged.scene.parent : null;
  const seekConfirm = (student?.security.needConfirmScore ?? 0) >= (student?.security.fearProbeScore ?? 0);
  const parentViewBand = student?.parentView.band ?? null;

  /* ------------------------------ 孩子本人 ------------------------------ */
  const studentPart: KitPart = {
    key: "student",
    label: "孩子本人",
    forWhom: "给孩子自己看的一份，不经过家长",
    headline: levelName ? `你想改的那一级：${levelName}` : "先挑一件小事，把真话说出来一次",
    blocks: [
      {
        h: "先认清你在做什么",
        lines: [
          level?.band === "断"
            ? "这一级你已经不走这条路了——不是不想要，是试过没用。这份锦囊不是让你去认错，是让你换一条更省力的路。"
            : "这一级还通，但每次都要鼓一次勇气。把鼓勇气这件事省下来，比多聊几次更有用。",
          parentViewBand === "低"
            ? "你心里对爸妈的评价不高，这很正常，也不用装。但你不需要为了证明这一点，把每一次谈话都变成对抗。"
            : "你其实还愿意跟他们说，只是每次说完都后悔——所以问题不在你愿不愿意说，在怎么说才不被接成教育。",
          "你不需要一次说完全部。一次只说一件事，说完就停，这比你准备三页纸有用。",
        ],
      },
      {
        h: "第一句话怎么说",
        lines: [
          "不要从「你从来都不……」开始。那句话一出口，对面听见的只有指责，后面说什么都听不进去。",
          "改成三段：我遇到什么事 → 我当时什么感觉 → 我需要你做什么。三段都不超过一句话。",
          sceneName
            ? `就从「${sceneName}」这件事开始——那是你选的、最常吵的一件事，先从最容易撞上的地方练。`
            : "先从最近一周真的发生过的一件小事开始，不要挑最大的那件。",
        ],
      },
      {
        h: "吵起来怎么退",
        lines: [
          "给自己一句退出语，提前想好，比如「我现在说不清楚，晚点再说」。说完就走开，不要边走边补一句。",
          seekConfirm
            ? "你偏「怕他们担心」这一类：他们没回你消息时，先问一句「你是不是不方便回」，别自己判成「他们生气了」。"
            : "你偏「越问越躲」这一类：不是不想说，是一开口要解释太多。那就先说结论，再决定要不要展开。",
          "退出不等于认输。你要的是把这件事解决掉，不是把这场架赢下来。",
        ],
      },
    ],
    say: [
      sceneName ? `「${sceneName}这件事，我有点想法，你能听我说两分钟吗？」` : "「我有件事想说，你能听我说两分钟吗？」",
      "「我不是要你同意，我是想让你知道我是怎么想的。」",
      "「我现在说不清楚，晚点再说。」",
    ],
    avoid: ["「你们根本不懂我。」——这句话是对的，但说完什么都不会变。", "「随便吧。」——省了这一句，下次更难开口。", "翻旧账：一次只谈一件事。"],
    ready: !!student,
    missing: student ? undefined : "孩子那份还没答，这一份还出不来。",
  };

  /* ------------------------------ 家长本人 ------------------------------ */
  const parentPart: KitPart = {
    key: "parent",
    label: "家长本人",
    forWhom: "给填了家长卷的这位看",
    headline: blind
      ? `这件事你估${blind.gap > 0 ? "高" : "低"}了：${blind.label}`
      : levelName
        ? `先只修一级：${levelName}`
        : "先把你以为的，和他实际答的，对上一次",
    blocks: [
      {
        h: "你以为的，和他答的",
        lines: [
          blind
            ? `「${blind.label}」这一项，你打 ${blind.parentScore} 分，他给自己打 ${blind.studentScore} 分。${
                blind.gap > 0
                  ? "你以为他更愿意、更靠近，实际不是。这不代表他不在乎你，代表他把这件事收了回去。"
                  : "他比你估的更靠你。这类偏差最容易被漏掉：你以为他不需要，其实他在等一个回应。"
              }`
            : "这次六项对照没有明显偏差，说明你平时看得还算准。那就把力气放在做法上，而不是判断上。",
          levelName
            ? `台阶上最要紧的是 ${levelName}。剩下的四级先别动——一次改五件事，等于一件都没改。`
            : "台阶这一块这次答得不全，先不下结论。",
          "你不需要变成一个更温和的人。你需要的是在那一件事上，换一个动作。",
        ],
      },
      {
        h: "怎么问，才不像审问",
        lines: [
          "先说你观察到的，再说你怎么想，最后问一句「我猜得对吗」。顺序反了就成了审问。",
          "问完要停三秒。这三秒里他要是没说话，就再等三秒——大多数真话是在第二段沉默里出来的。",
          seekConfirm
            ? "他偏「怕你担心」：他要的不是更多关心，是更确定的回应。说清楚你什么时候回、说清楚不是他的错。"
            : "他偏「越问越躲」：越追越躲。改成「我不问了，你想说的时候我在」，然后真的不问。",
        ],
      },
      {
        h: mismatch
          ? "你们吵的其实不是同一件事"
          : "最容易吵起来的那件事",
        lines: mismatch
          ? [
              `他选的是「${sceneName ?? "另一件事"}」，你选的是「${parentScene ?? "这件"}」。同一个晚上，你们在解决两个问题。`,
              "下次开口前先把「到底在吵什么」说成一句双方都认的话。认不下来，就先只谈他选的那件。",
              "这一步比你讲多少道理都有用：被听错主题的人，是不会听内容的。",
            ]
          : [
              sceneName
                ? `你们都选了「${sceneName}」，至少吵的是同一件事。这种局面好办：只谈这一件，别扩到态度和人品。`
                : "这次没对到同一件冲突场景，先不谈具体事件，只练问句。",
              "定一条停火规则：声音一高就停，谁先发现谁喊停，隔天再谈。规则要提前说，不能吵到一半才提。",
              "谈完给一个具体约定，不要给一个态度要求。「十点前把手机放客厅」比「你要自觉」有用一百倍。",
            ],
      },
    ],
    say: [
      "「我观察到……我猜你可能是……我猜得对吗？」",
      "「这件事我想听你的想法，你先说。」",
      "「我不问了，你想说的时候我在。」",
    ],
    avoid: [
      "「我都是为你好。」——这句话一出现，谈话就结束了。",
      "在孩子面前否定另一半的做法。",
      "拿别人家孩子做参照。",
    ],
    ready: hasParent,
    missing: hasParent ? undefined : "家长卷还没填，这一份还出不来。",
  };

  /* ---------------------------- 多人 · 父母 ---------------------------- */
  const bothParents = parentCount >= 2;
  const parentsPart: KitPart = {
    key: "parents",
    label: "多人 · 父母版",
    forWhom: "爸爸和妈妈一起看，谈之前先对齐",
    headline: bothParents
      ? "两个人先统一口径，再一起面对孩子"
      : "先把另一位的答卷补齐，这一版才有意义",
    blocks: [
      {
        h: "先私下对齐，别当着孩子争",
        lines: [
          "你们两个对同一件事的判断常常不一样——这很正常，但孩子面前只能有一种口径。",
          "做法：谈之前先花十分钟，只确认三件事——这件事谁去谈、谈到什么程度算谈完、谈崩了怎么收。",
          "如果两人的判断还是不一样，就按「当场更严格的那位说了算」处理，事后再统一。不要当着孩子改口。",
        ],
      },
      {
        h: "分工：一个人主谈，一个人收尾",
        lines: [
          "两个人都开口，孩子只会挑软的那位回应，硬的那位变成背景音。",
          levelName
            ? `这次先谈 ${levelName}。谁跟孩子更聊得开，谁主谈；另一位负责在谈崩之后把气氛收回来。`
            : "选一件具体的事先谈，别一开口就是「我们想跟你聊聊」——那句话等于宣布审判开始。",
          "主谈的人说完就停，另一位不要补充。补充的那几句，通常就是把气氛搞僵的那几句。",
        ],
      },
      {
        h: "两种常见的反向操作",
        lines: [
          "一个唱红脸一个唱白脸：孩子学到的不是规矩，是「找谁有用」。短期有效，长期把两个人的话都变成可谈价。",
          "在孩子面前互相拆台：你以为是在缓和，孩子收到的是「这件事没有标准」。",
          sceneName ? `这次最容易撞上的是「${sceneName}」，两个人先把这一件的口径写成一句话，再谈别的。` : "先把最容易撞上的那件事写成一句话，再谈别的。",
        ],
      },
    ],
    say: [
      "「这件事我们俩商量过了，结论是一样的。」",
      "「你先说，我们听完再回应。」",
      "「这件事爸爸/妈妈比我更清楚，让他说。」",
    ],
    avoid: ["「你爸/你妈那脾气你别理。」", "当着孩子推翻另一半刚定下的规矩。", "一个答应、一个否决，让孩子自己找突破口。"],
    ready: !!merged && hasParent,
    missing: bothParents
      ? undefined
      : hasParent
        ? "目前只收到一份家长卷。这一版讲的是两个人怎么配合，等另一位也填完再看更准。"
        : "家长卷还没填，这一版还出不来。",
  };

  /* ---------------------------- 多人 · 子女 ---------------------------- */
  const childrenPart: KitPart = {
    key: "children",
    label: "多人 · 子女版",
    forWhom: "家里不止一个孩子，或者爸妈两个人很不一样时看",
    headline: "爸妈不一样，不是有人不爱你",
    blocks: [
      {
        h: "两个人不一样，是两种表达方式",
        lines: [
          "一个管得细、一个不太管；一个容易急、一个不太接话。这在很多家里是分工，不是偏心。",
          "但你可以不认同这个分工。你可以要求：重要的事，两个人都在场的时候说一次。",
          "有一个办法几乎总是有效：把同一件事，分别跟两个人说一遍，用同一套说法。别让任何一方觉得「你只跟他说」。",
        ],
      },
      {
        h: "家里不止一个孩子的时候",
        lines: [
          "被比较是最常见、也最伤人的一件事。「你看你哥/你姐」这句话一出来，你要么变成对手，要么变成影子。",
          "你能做的是把比较挡回去：不谈谁更好，只谈「我这件需要什么」。比较是他们的语言，你不必接。",
          "如果家里的注意力长期偏向另一个孩子，这不代表你不重要。但这句话你自己说了没人信——找一个家里最听得进话的人，只跟他说一次。",
        ],
      },
      {
        h: "找一个第一站",
        lines: [
          "家里通常有一个人，是你开口成本最低的。先找这个人，不要一上来就挑最难的那位。",
          levelName
            ? `这次先从 ${levelName} 这件事试：跟第一站的人说，再让这个人陪你去跟另一位说。`
            : "先从最近真的发生过的一件小事试，不要挑最大的那件。",
          "一次只找一个人。两个人在场的时候谈崩了，你连退的地方都没有。",
        ],
      },
    ],
    say: [
      "「这件事我跟你也说一遍，跟我爸/我妈说的是一样的。」",
      "「我不是在比谁更好，我是在说我这件需要什么。」",
      "「这件事我想先跟你说，你再陪我一起跟他们说，行吗？」",
    ],
    avoid: ["「反正你们只喜欢他。」——这句是真的也很难被听见，先换成具体的一件事。", "在两个家长之间传话，把两边的话都加工一遍。", "为了让谁满意，答应自己做不到的事。"],
    ready: !!student,
    missing: student ? undefined : "孩子那份还没答，这一版还出不来。",
  };

  return [studentPart, parentPart, parentsPart, childrenPart];
}
