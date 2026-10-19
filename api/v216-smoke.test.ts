/* v216 冒烟：伴学师跨机构分配的学员不可见修复。
   问题（孙冬晓 2026-10-19）：平台伴学师（机构1）被分配了校园渠道学员（粤华学校，机构619662），
   登录后名下学员为空——listStudents 的 orgScope 在 SQL 层按伴学师所属机构过滤，
   跨机构分配的学员在「按分配过滤」之前就被排除。
   口径：非管理员伴学师 myStudents 拉全量后按「分配给我」过滤（管理员仍按机构范围）。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v216 伴学师跨机构分配可见性", () => {
  const coach = read("api/coachRouter.ts");
  const router = read("api/router.ts");

  it("伴学师（非管理员）myStudents 不再按自己机构做 SQL 预过滤", () => {
    if (!/ctx\.user\.role === "admin" \? ctx\.user\.orgId : null/.test(coach))
      throw new Error("缺：伴学师按全量拉取后按分配过滤");
    if (/listStudents\(getDb\(\), ctx\.user\.orgId\)/.test(coach))
      throw new Error("残留：myStudents 仍对伴学师按 orgId 预过滤");
  });

  it("BUILD_TAG 已递增到 v216", () => {
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 216) throw new Error(`BUILD_TAG 未递增到 v216（当前 v${v}）`);
  });
});
