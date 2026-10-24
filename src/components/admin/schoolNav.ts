/**
 * v232 首屏提速：学校版侧边栏「菜单数据」独立成轻量模块。
 * 背景：Layout（首屏组件）原先 import SchoolConsole 只为拿菜单数据，
 * 导致整个后台控制台（961 行 + 全部 tab 组件）被打进入口 chunk。
 * 现在 Layout 与本文件单向依赖，SchoolConsole 按需懒加载。
 */
import { AlertTriangle, BadgeCheck, BarChart3, BookOpen, ClipboardList, FolderHeart, Gauge, LayoutGrid, Network, PieChart, QrCode, UserCog, Users, type LucideIcon } from "lucide-react";

export type ItemKey = "assess" | "tasks" | "progress" | "intention" | "selection" | "archive" | "students" | "teachers" | "warnings" | "invites" | "users" | "library" | "features";
export type SchoolItemKey = ItemKey;

export const GROUPS: { label: string; items: { key: ItemKey; label: string; icon: LucideIcon; jiaowu?: boolean }[] }[] = [
  {
    label: "测评管理",
    items: [
      { key: "assess", label: "测评中心", icon: LayoutGrid },
      { key: "tasks", label: "施测任务", icon: ClipboardList },
      { key: "progress", label: "进度看板", icon: Gauge },
    ],
  },
  {
    label: "数据统计",
    items: [
      { key: "intention", label: "选科意向分析", icon: BarChart3 },
      { key: "selection", label: "选科统计分析", icon: PieChart },
      { key: "archive", label: "成长档案", icon: FolderHeart },
    ],
  },
  {
    label: "学生管理",
    items: [
      { key: "students", label: "学员管理", icon: Users, jiaowu: true },
      { key: "teachers", label: "指导老师", icon: UserCog },
    ],
  },
  {
    label: "学校管理",
    items: [
      { key: "warnings", label: "预警中心", icon: AlertTriangle },
      { key: "invites", label: "注册邀请", icon: QrCode },
      { key: "users", label: "组织架构", icon: Network },
      { key: "features", label: "版本与功能", icon: BadgeCheck },
    ],
  },
  {
    label: "教学资源",
    items: [{ key: "library", label: "资料库", icon: BookOpen }],
  },
];

/* v220.3：教务可见项（学校版教务：看统计/预警/意向/催办/档案 + 学员分配台） */
const JIAOWU_KEYS: SchoolItemKey[] = ["assess", "tasks", "progress", "intention", "selection", "archive", "warnings", "students"];

/** v220.3：供外层侧边栏（Layout）渲染学校版菜单；jiaowu=只返回教务可见项 */
export function visibleSchoolGroups(jiaowu: boolean) {
  if (!jiaowu) return GROUPS;
  return GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => JIAOWU_KEYS.includes(it.key)) })).filter((g) => g.items.length > 0);
}
