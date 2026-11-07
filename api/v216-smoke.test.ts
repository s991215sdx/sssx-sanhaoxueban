/* v216 的跨机构全量读取策略由 v256 修订：同一手机号的各机构身份是独立账号，
   各自只看当前机构与当前 users.id 的名下学员，旧跨机构关系不能穿透。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v256 多机构身份的伴学师名单隔离", () => {
  const coach = read("api/coachRouter.ts");
  const router = read("api/router.ts");

  it("伴学师和管理员都先按当前机构取数，再按当前身份过滤", () => {
    if (!/listStudents\(getDb\(\), ctx\.user\.orgId\)/.test(coach))
      throw new Error("缺：myStudents 当前机构范围");
    if (/ctx\.user\.role === "admin" \? ctx\.user\.orgId : null/.test(coach))
      throw new Error("残留：伴学师全量拉取策略");
  });

  it("BUILD_TAG 不低于 v216", () => {
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 216) throw new Error(`BUILD_TAG 未递增到 v216（当前 v${v}）`);
  });
});
