/**
 * v238 家庭码：父母扫同一个码，答案落到同一个孩子名下。
 *
 * 锁三件事：
 *  1. 码的形状与归一化（家长手输/粘贴时大小写、全角横线都不该出事）；
 *  2. 编解码往返与防篡改（改一位编号就能认成别人家孩子，是最严重的那种错）；
 *  3. 同一位家长重填怎么算（不然报告里会变成「两位家长」）。
 */
import { describe, expect, it } from "vitest";
import {
  FAMILY_CODE_SIG_LEN,
  familyChildAlias,
  familyJoinPath,
  latestPerRespondent,
  normalizeFamilyCode,
} from "../contracts/familyCode";
import { decodeFamilyCode, encodeFamilyCode } from "../api/familyCode";

const SECRET = "test-secret-for-family-code";

describe("家庭码格式", () => {
  it("码是「编号-版本-签名」三段", () => {
    const code = encodeFamilyCode(18, 0, SECRET);
    expect(code.split("-")).toHaveLength(3);
    /* 签名固定 6 位，方便肉眼核对是不是少复制了字符 */
    expect(code.split("-")[2]).toHaveLength(FAMILY_CODE_SIG_LEN);
  });

  it("扫码链接里带大写或空白也能认出来", () => {
    expect(normalizeFamilyCode("  A1-0-K3M9PD ")).toBe("a1-0-k3m9pd");
  });

  it("粘贴时混进全角横线也能救回来", () => {
    expect(normalizeFamilyCode("a1—0—k3m9pd")).toBe("a1-0-k3m9pd");
    expect(normalizeFamilyCode("a1－0－k3m9pd")).toBe("a1-0-k3m9pd");
  });

  it("链接路径统一小写、固定 /f/ 前缀", () => {
    expect(familyJoinPath("A1-0-K3M9PD")).toBe("/f/a1-0-k3m9pd");
  });
});

describe("编解码", () => {
  it("同一个孩子、同一版本，每次算出来都一样（不需要存）", () => {
    expect(encodeFamilyCode(18, 0, SECRET)).toBe(encodeFamilyCode(18, 0, SECRET));
  });

  it("往返解得回原编号与版本", () => {
    for (const uid of [1, 18, 999, 123456]) {
      const code = encodeFamilyCode(uid, 0, SECRET);
      expect(decodeFamilyCode(code, SECRET)).toEqual({ userId: uid, ver: 0 });
    }
  });

  it("换过码之后，旧码解出来的版本对不上，业务层据此判失效", () => {
    const oldCode = encodeFamilyCode(18, 0, SECRET);
    const newCode = encodeFamilyCode(18, 1, SECRET);
    expect(decodeFamilyCode(oldCode, SECRET)?.ver).toBe(0);
    expect(decodeFamilyCode(newCode, SECRET)?.ver).toBe(1);
    expect(oldCode).not.toBe(newCode);
  });

  it("换个密钥就算不出同一张码——签名是防伪造的唯一依据", () => {
    const code = encodeFamilyCode(18, 0, SECRET);
    expect(decodeFamilyCode(code, "another-secret")).toBeNull();
  });

  it("改掉编号里的任何一位都解不出来", () => {
    const code = encodeFamilyCode(18, 0, SECRET);
    const [id, ver, sig] = code.split("-");
    const bumped = `${id.slice(0, -1)}${id.endsWith("i") ? "j" : "i"}-${ver}-${sig}`;
    expect(decodeFamilyCode(bumped, SECRET)).toBeNull();
  });

  it("改掉签名的一位也解不出来", () => {
    const [id, ver, sig] = encodeFamilyCode(18, 0, SECRET).split("-");
    const tampered = `${id}-${ver}-${sig.slice(0, -1)}${sig.endsWith("a") ? "b" : "a"}`;
    expect(decodeFamilyCode(tampered, SECRET)).toBeNull();
  });

  it("形状不对的直接拒掉，不进签名比对", () => {
    for (const bad of ["", "abc", "a1-0", "a1-0-xx", "!!!-0-abcdef"]) {
      expect(decodeFamilyCode(bad, SECRET)).toBeNull();
    }
  });
});

describe("家长端看到的孩子称谓", () => {
  it("只露姓，不露全名——码可能被转发到群里", () => {
    expect(familyChildAlias("张三")).toBe("张同学");
    expect(familyChildAlias("张三")).not.toContain("三");
  });

  it("复姓取两个字，不然「欧阳」会变成「欧同学」", () => {
    expect(familyChildAlias("欧阳明")).toBe("欧阳同学");
    expect(familyChildAlias("司马光")).toBe("司马同学");
  });

  it("名字为空时给一个中性称呼，不显示空白", () => {
    expect(familyChildAlias("")).toBe("孩子");
    expect(familyChildAlias("   ")).toBe("孩子");
  });
});

describe("同一位家长重填", () => {
  it("只留最新一份，不变成「两位家长」", () => {
    const rows = [
      { respondent: "mom", label: "妈妈", at: 3 },
      { respondent: "dad", label: "爸爸", at: 2 },
      { respondent: "mom", label: "妈妈", at: 1 },
    ];
    const out = latestPerRespondent(rows);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.respondent)).toEqual(["mom", "dad"]);
    /* 留下的是 at=3 那条（入参已按时间倒序），不是旧答案 */
    expect(out[0].at).toBe(3);
  });

  it("爸爸、妈妈各一份，两份都保留", () => {
    const out = latestPerRespondent([
      { respondent: "dad", at: 2 },
      { respondent: "mom", at: 1 },
    ]);
    expect(out).toHaveLength(2);
  });

  it("一位家长都没填时返回空数组，不造一条假记录", () => {
    expect(latestPerRespondent([])).toEqual([]);
  });
});
