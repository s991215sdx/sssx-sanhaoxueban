/**
 * 答题明细数据层（纯函数，无 React）：从各测评原始作答构建逐题明细块。
 * 供 ReportDetail 页面渲染与 /tmp/review_v37_report.ts 冒烟脚本断言共用。
 *
 * V33.2：
 * - 修复模块折叠答题明细不显示：顶层 kinds 过滤需放行「e3:乐学」这类段过滤器
 *   （原实现 `!kinds.includes(r.kind)` 把 kind="e3" 的记录直接跳过，段拆分永远空）。
 * - discparent 题干改用家长家庭版 DISC_PARENT_QUESTIONS（24 题）。
 * - mental 明细兼容 V2（PHQ-9+GAD-7 共 16 题，0-3 四级评分）与旧版 V1（30 题）。
 */

import {
  MBTI_QUESTIONS,
  DISC_QUESTIONS,
  DISC_PARENT_QUESTIONS,
  DISC_V2_GROUPS,
  DISC_PARENT_V2_GROUPS,
  isDiscV2Answers,
  type DiscWordGroup,
} from "@contracts/assessments";
import {
  E3V37_QUESTIONS,
  E3V37_LIFE_EVENTS,
  E3V37_OPEN_QUESTIONS,
  E3V37_MOTIVATION_OPTIONS,
} from "@contracts/e3v37";
import type { E3V37Stage } from "@contracts/e3v37";
import {
  E3V37P_FAMILY_QUESTIONS,
  E3V37P_COND_OBSERVE,
  E3V37P_MIRROR_QUESTIONS,
  E3V37P_MIRROR_HINTS,
} from "@contracts/e3v37Parent";
import { MULTI5_QUESTIONS } from "@contracts/multi5";
import { ANCHOR_RATINGS } from "@contracts/careerAnchor";
import { HOLLAND_RATINGS } from "@contracts/holland";
import { MENTAL_RATINGS, MENTAL_V2_SECTIONS, MENTAL_V2_OPTIONS, MENTAL_V2_QUESTION_COUNT } from "@contracts/mentalHealth";

export type AnswerRow = { no: number | string; text: string; ans: string; bad?: boolean };
export type AnswerBlock = { key: string; title: string; note?: string; rows: AnswerRow[] };

export type RawAnswer = { kind: string; answers: unknown; createdAt: Date | string };

/**
 * 章节标题 → 该章「详细报告文字」折叠末尾应挂的答题明细 kind 过滤。
 * 与 ReportDetail 详版章节映射保持一致（单一事实源，页面与冒烟脚本共用）。
 */
export function answerKindsForSection(title: string, hasAcadSec: boolean): string[] | null {
  const modSys = (["乐学", "会学", "善学"] as const).find((k) => title.includes(`${k}模块`));
  if (modSys) return [`e3:${modSys}`];
  if (title.includes("条件模块")) {
    return ["mental", "e3parent", "discparent", "mbti", "disc", "e3:条件", ...(hasAcadSec ? [] : ["e3:快扫"])];
  }
  if (title.includes("成绩现状")) return ["e3:快扫"];
  if (title.includes("学能模块")) return ["multi5", "e3:学能"];
  if (title.includes("兴趣与方向")) return ["anchor", "holland"];
  return null;
}

export function buildAnswerBlocks(raw: RawAnswer[], kinds?: string[]): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  for (const r of raw) {
    /* kinds 过滤：精确匹配 kind，或段过滤器（如 "e3:乐学" 放行 kind="e3" 的记录，段内再细分）。 */
    if (kinds && !kinds.includes(r.kind) && !kinds.some((k) => k.startsWith(`${r.kind}:`))) continue;
    const date = new Date(r.createdAt).toLocaleDateString("zh-CN");
    if (r.kind === "mbti" && Array.isArray(r.answers)) {
      const a = r.answers as number[];
      blocks.push({
        key: "mbti",
        title: `MBTI 性格测评 · ${a.length} 题（${date}）`,
        note: "每题二选一，A/B 为你选的选项。",
        rows: MBTI_QUESTIONS.map((q, i) => ({
          no: i + 1,
          text: q.text,
          ans: a[i] === 0 ? `A · ${q.a}` : a[i] === 1 ? `B · ${q.b}` : "未答",
        })),
      });
    } else if ((r.kind === "disc" || r.kind === "discparent") && r.answers != null) {
      /* 作答形态：number[]（旧版学生）；{ most, least }（V2 学生）；
         { label, answers: number[] | { most, least } }（家长，旧版/V2）。 */
      const payload = r.answers as
        | number[]
        | { most: number[]; least: number[] }
        | { label?: string; answers?: number[] | { most: number[]; least: number[] } };
      const label = Array.isArray(payload) || isDiscV2Answers(payload) ? "" : (payload.label ?? "");
      const inner = Array.isArray(payload) || isDiscV2Answers(payload) ? payload : (payload.answers ?? []);
      const who = r.kind === "discparent" ? `家长 DISC${label ? `（${label}）` : ""}` : "DISC 行为风格";
      if (isDiscV2Answers(inner)) {
        /* V2 强迫选择：每组 4 词，标注最像/最不像 */
        const groups: DiscWordGroup[] = r.kind === "discparent" ? DISC_PARENT_V2_GROUPS : DISC_V2_GROUPS;
        blocks.push({
          key: `${r.kind}-${label || blocks.length}`,
          title: `${who} · ${groups.length} 组（${date}）`,
          note: "每组 4 个描述词，各选 1 个「最像我」+ 1 个「最不像我」。",
          rows: groups.map((g, i) => ({
            no: i + 1,
            text: g.words.join(" / "),
            ans: `最像「${g.words[inner.most[i]] ?? "?"}」 · 最不像「${g.words[inner.least[i]] ?? "?"}」`,
          })),
        });
        continue;
      }
      const a = Array.isArray(inner) ? inner : [];
      if (a.length === 0) continue;
      /* 旧版二选一：家长卷题干用家庭版 DISC_PARENT_QUESTIONS（24 题，亲子场景），学生卷用 DISC_QUESTIONS */
      const qs = r.kind === "discparent" ? DISC_PARENT_QUESTIONS : DISC_QUESTIONS;
      blocks.push({
        key: `${r.kind}-${label || blocks.length}`,
        title: `${r.kind === "discparent" ? `家长 DISC${label ? `（${label}）` : ""}` : "DISC 行为风格"} · ${a.length} 题（${date}）`,
        note: "（旧版题目）每题二选一，A/B 为选的选项。",
        rows: qs.map((q, i) => ({
          no: i + 1,
          text: q.text,
          ans: a[i] === 0 ? `A · ${q.a}` : a[i] === 1 ? `B · ${q.b}` : "未答",
        })),
      });
    } else if (r.kind === "e3" && r.answers && typeof r.answers === "object") {
      const ans = r.answers as {
        ratings?: number[];
        stage?: E3V37Stage;
        motivation?: string;
        subjects?: { name: string; liking: number; mastery: number; exam: number; rank?: string; weakest?: string }[];
        lossReasons?: string[];
        scoreTrend?: string;
        lifeEvents?: number[];
        openAnswers?: string[];
      };
      const a = ans.ratings ?? [];
      const stage: E3V37Stage = ans.stage === "primary" || ans.stage === "senior" ? ans.stage : "junior";
      const qs = E3V37_QUESTIONS[stage];
      /* 答题明细按段拆分：乐学/会学/善学/条件/学能/学科快扫，随章节下沉；
         kinds 含 "e3" 时全部返回，含 "e3:乐学" 等段名时只返回对应段。 */
      const wantSeg = (seg: string) => !kinds || kinds.includes("e3") || kinds.includes(`e3:${seg}`);
      const mkRows = (min: number, max: number): AnswerRow[] =>
        qs
          .filter((q) => q.no >= min && q.no <= max)
          .map((q) => {
            const v = a[q.no - 1] ?? 0;
            const adj = q.reverse ? 6 - v : v;
            return { no: q.no, text: `[${q.kp}] ${q.text}`, ans: `${v} 分`, bad: adj <= 2 };
          });
      const RATE_NOTE = "1-5 分自评；红色为换算后 ≤2 分的题（明显短板）。";
      if (wantSeg("乐学")) {
        blocks.push({ key: "e3-lexue", title: `E3 学业诊断 · 乐学（动力系统）第 1-21 题（${date}）`, note: RATE_NOTE, rows: mkRows(1, 21) });
      }
      if (wantSeg("会学")) {
        blocks.push({ key: "e3-huixue", title: `E3 学业诊断 · 会学（行为系统）第 22-33 题（${date}）`, note: RATE_NOTE, rows: mkRows(22, 33) });
      }
      if (wantSeg("善学")) {
        blocks.push({ key: "e3-shanxue", title: `E3 学业诊断 · 善学（加速系统）第 34-49 题（${date}）`, note: RATE_NOTE, rows: mkRows(34, 49) });
      }
      if (wantSeg("条件")) {
        const rows = mkRows(50, 67);
        const mo = E3V37_MOTIVATION_OPTIONS.find((o) => o.key === ans.motivation);
        if (mo) rows.push({ no: "状态", text: `学习状态单选：${mo.text}`, ans: `${mo.key} · ${mo.label}（${mo.score}/5）`, bad: mo.score <= 2 });
        const events = E3V37_LIFE_EVENTS[stage] ?? E3V37_LIFE_EVENTS.junior;
        (ans.lifeEvents ?? []).forEach((v, i) => {
          const ev = events[i];
          if (!ev) return;
          rows.push({ no: ev.no, text: `生活事件 · ${ev.text}`, ans: ["没发生", "轻度", "中度", "重度"][v] ?? `${v}`, bad: v >= 2 });
        });
        E3V37_OPEN_QUESTIONS.forEach((q, i) => {
          rows.push({ no: "开放", text: q, ans: ans.openAnswers?.[i]?.trim() ? ans.openAnswers[i] : "未填" });
        });
        blocks.push({ key: "e3-tiaojian", title: `E3 学业诊断 · 条件（支持系统）第 50-67 题 + 状态单选/生活事件/开放题（${date}）`, note: RATE_NOTE, rows });
      }
      if (wantSeg("学能")) {
        blocks.push({ key: "e3-xueneng", title: `E3 学业诊断 · 学能三项第 68-70 题（单独报告不进总分）（${date}）`, note: RATE_NOTE, rows: mkRows(68, 70) });
      }
      if (wantSeg("快扫")) {
        const rows: AnswerRow[] = (ans.subjects ?? [])
          .filter((s) => s.name?.trim())
          .map((s, i) => {
            const closed = s.liking === 0 && s.mastery === 0 && s.exam === 0;
            return {
              no: i + 1,
              text: s.name,
              ans: closed
                ? "未开设"
                : `喜欢 ${s.liking} · 掌握 ${s.mastery} · 发挥 ${s.exam}${s.rank ? ` · 排名 ${s.rank}` : ""}${s.weakest ? ` · 薄弱：${s.weakest}` : ""}`,
            };
          });
        if (ans.lossReasons?.length) rows.push({ no: "主因", text: "考试失分主因（多选）", ans: ans.lossReasons.join("、") });
        if (ans.scoreTrend) rows.push({ no: "趋势", text: "成绩趋势", ans: ans.scoreTrend });
        if (rows.length > 0) {
          blocks.push({
            key: "e3-kuaisao",
            title: `学科快速扫描（${date}）`,
            note: "喜欢/掌握/发挥 1-5 自评；各科成绩与目标在「个人中心 · 成绩与目标」填写，快扫不含成绩分。",
            rows,
          });
        }
      }
    } else if (r.kind === "e3parent" && r.answers && typeof r.answers === "object") {
      const ans = r.answers as {
        family?: Record<string, number>;
        distractions?: number[];
        familyChangeNote?: string;
        wish?: string;
        condObserve?: Record<string, number>;
        mirror?: number[];
      };
      const rows: AnswerRow[] = [];
      for (const q of E3V37P_FAMILY_QUESTIONS) {
        if (q.key === "distractions") {
          const picks = (ans.distractions ?? []).map((i) => q.options?.[i] ?? `${i}`);
          rows.push({ no: "家庭", text: q.title, ans: picks.length ? picks.join("、") : "未答" });
        } else if (q.open && !q.options) {
          rows.push({ no: "家庭", text: q.title, ans: ans.wish?.trim() ? ans.wish : "未填" });
        } else if (q.open) {
          const idx = ans.family?.[q.key];
          const base = idx != null ? q.options?.[idx] ?? "未答" : "未答";
          const note = q.key === "familyChange" && ans.familyChangeNote?.trim() ? `（${ans.familyChangeNote.trim()}）` : "";
          rows.push({ no: "家庭", text: q.title, ans: `${base}${note}`, bad: q.key === "familyChange" && idx === 4 });
        } else {
          const idx = ans.family?.[q.key];
          rows.push({ no: "家庭", text: q.title, ans: idx != null ? q.options?.[idx] ?? "未答" : "未答" });
        }
      }
      for (const item of E3V37P_COND_OBSERVE) {
        const idx = ans.condObserve?.[item.key];
        rows.push({ no: "条件", text: `${item.label}（对应学生 ${item.ref} 题）`, ans: idx != null ? item.options[idx] ?? "未答" : "未答", bad: idx === 2 });
      }
      (ans.mirror ?? []).forEach((v, i) => {
        const q = E3V37P_MIRROR_QUESTIONS[i];
        if (!q) return;
        rows.push({ no: q.key, text: q.text, ans: E3V37P_MIRROR_HINTS[v] ?? `${v}`, bad: v >= 1 && v <= 2 });
      });
      blocks.push({
        key: "e3parent",
        title: `E3 家长卷 V3.7（${date}）`,
        note: "家庭 9 题 + 条件观察 7 行（红色=家长认为较差）+ 认知对照 16 题（0=不了解，红色为 1-2 低分项）。",
        rows,
      });
    } else if (r.kind === "multi5" && Array.isArray(r.answers)) {
      const a = r.answers as number[];
      blocks.push({
        key: "multi5",
        title: `多元智能五项（客观题）· ${a.length} 题（${date}）`,
        note: "客观作答；红色为答错的题，括号内为正确选项。",
        rows: MULTI5_QUESTIONS.map((q, i) => {
          const v = a[i];
          const letters = ["A", "B", "C", "D"];
          const ok = v === q.answer;
          return {
            no: q.no,
            text: q.text,
            ans: v != null ? `${letters[v]}${ok ? "" : `（正确：${letters[q.answer]}）`}` : "未答",
            bad: !ok,
          };
        }),
      });
    } else if (r.kind === "anchor" && Array.isArray(r.answers)) {
      const a = r.answers as number[];
      blocks.push({
        key: "anchor",
        title: `职业锚 · ${a.length} 题（${date}）`,
        note: "1-5 分评分；红色为换算后 ≤2 分的题。",
        rows: ANCHOR_RATINGS.map((q, i) => {
          const v = a[i] ?? 0;
          const adj = q.reverse ? 6 - v : v;
          return { no: q.no, text: q.text, ans: `${v} 分`, bad: adj <= 2 };
        }),
      });
    } else if (r.kind === "holland" && Array.isArray(r.answers)) {
      const a = r.answers as number[];
      blocks.push({
        key: "holland",
        title: `霍兰德职业兴趣 · ${a.length} 题（${date}）`,
        note: "1-5 分兴趣评分；红色为 ≤2 分（不感兴趣）的题。",
        rows: HOLLAND_RATINGS.map((q, i) => ({
          no: q.no,
          text: q.text,
          ans: `${a[i] ?? 0} 分`,
          bad: (a[i] ?? 0) <= 2,
        })),
      });
    } else if (r.kind === "mental" && Array.isArray(r.answers)) {
      const a = r.answers as number[];
      if (a.length === MENTAL_V2_QUESTION_COUNT) {
        /* V2：PHQ-9（1-9 题）+ GAD-7（10-16 题），0-3 四级评分 */
        const v2Questions = MENTAL_V2_SECTIONS.flatMap((s) => s.questions);
        blocks.push({
          key: "mental",
          title: `心理健康筛查（PHQ-9 + GAD-7 专业版）· ${a.length} 题（${date}）`,
          note: "0=完全不会 / 1=好几天 / 2=超过一半的天数 / 3=几乎天天；红色为 ≥2 分的题（达到中度）。第 9 题不是「完全不会」时请务必告诉家长或老师。",
          rows: v2Questions.map((q, i) => ({
            no: q.no,
            text: `${q.no <= 9 ? "[PHQ-9] " : "[GAD-7] "}${q.text}`,
            ans: a[i] != null ? `${a[i]} · ${MENTAL_V2_OPTIONS[a[i]]?.label ?? a[i]}` : "未答",
            bad: (a[i] ?? 0) >= 2,
          })),
        });
      } else {
        /* 旧版 V1：30 题十因子（历史数据兼容） */
        blocks.push({
          key: "mental",
          title: `心理健康筛查（旧版十因子，量表已升级）· ${a.length} 题（${date}）`,
          note: "1-5 分状态自评（近一周）；红色为 ≥4 分的题。量表已升级为 PHQ-9+GAD-7 专业版（16 题），建议重新测评。",
          rows: MENTAL_RATINGS.map((q, i) => ({
            no: q.no,
            text: q.text,
            ans: `${a[i] ?? 0} 分`,
            bad: (a[i] ?? 0) >= 4,
          })),
        });
      }
    }
  }
  return blocks;
}
