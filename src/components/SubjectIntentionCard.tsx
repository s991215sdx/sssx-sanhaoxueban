/**
 * v220 学校版——选科意向确认卡（学生/家长端，挂在选科及升学规划报告的推荐组合下方）。
 * 从系统三大推荐中确认一个，或自定义组合（必须填写理由）；按管理员开放的轮次提交。
 */
import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";

const FIRST_OPTS = ["物理", "历史"] as const;
const SECOND_OPTS = ["化学", "生物", "政治", "地理"] as const;

const CHOICE_LABEL: Record<string, string> = { rec1: "第一推荐", rec2: "第二推荐", rec3: "第三推荐", custom: "自定义" };

export default function SubjectIntentionCard() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.school.intentions.myOptions.useQuery();
  const submit = trpc.school.intentions.submit.useMutation({
    onSuccess: () => utils.school.intentions.myOptions.invalidate(),
  });
  const [choice, setChoice] = useState<string>("rec1");
  const [first, setFirst] = useState<string>("物理");
  const [pick1, setPick1] = useState<string>("化学");
  const [pick2, setPick2] = useState<string>("生物");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (data?.combos) {
      setFirst(data.combos.rec1[0] ?? "物理");
      setPick1(data.combos.rec1[1] ?? "化学");
      setPick2(data.combos.rec1[2] ?? "生物");
    }
  }, [data?.combos]);
  if (isLoading) return null;
  if (!data) return null;
  const { combos, openRoundNo, openRoundLabel, mine } = data;
  const submitted = openRoundNo != null ? mine.find((m) => m.roundNo === openRoundNo) : undefined;

  const doSubmit = () => {
    if (openRoundNo == null) return;
    let subjects: string[];
    if (choice === "custom") {
      subjects = [first, pick1, pick2];
      if (new Set(subjects).size !== 3) {
        alert("自定义组合的三门学科不能重复");
        return;
      }
    } else {
      subjects = combos![choice as "rec1" | "rec2" | "rec3"];
    }
    submit.mutate({ roundNo: openRoundNo, choice: choice as "rec1" | "rec2" | "rec3" | "custom", subjects, reason, source: "parent" });
  };

  return (
    <div className="card no-print" style={{ marginTop: 14, border: "1px solid #0C706455", background: "#F4FAF7" }}>
      <b style={{ color: "#1E3530", fontSize: 15 }}>确认我的选科意向</b>
      <p style={{ fontSize: 12.5, color: "#5B6B63", marginTop: 4, marginBottom: 10 }}>
        请与孩子商议后，从系统推荐中确认一个组合，或填写自定义组合。自定义需说明理由，老师将据此跟进。
      </p>
      {openRoundNo == null ? (
        <p style={{ fontSize: 13, color: "#B4552D" }}>
          当前没有开放的意向轮次{data.rounds.length ? "（各轮次均已截止）" : ""}，请等待老师通知。
        </p>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: "#0C7064", marginBottom: 8, fontWeight: 700 }}>
            {openRoundLabel || `第${openRoundNo}轮意向`}·开放中{submitted ? `（已确认：${submitted.subjects.join("/")}，可修改后重新提交）` : ""}
          </div>
          {!combos ? (
            <p style={{ fontSize: 13, color: "#5B6B63" }}>完成学科四维测评后，这里会显示系统的三大推荐组合。</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {(["rec1", "rec2", "rec3"] as const).map((k) => (
                <label
                  key={k}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: choice === k ? "2px solid #0C7064" : "1px solid #D8D2BC",
                    background: choice === k ? "#fff" : "transparent",
                    cursor: "pointer",
                    fontSize: 13.5,
                  }}
                >
                  <input type="radio" name="intention-choice" checked={choice === k} onChange={() => setChoice(k)} />
                  <b style={{ color: "#1E3530" }}>{CHOICE_LABEL[k]}</b>
                  <span style={{ color: "#0C7064", fontWeight: 700 }}>{combos[k].join(" + ")}</span>
                </label>
              ))}
              <label
                style={{
                  display: "block",
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: choice === "custom" ? "2px solid #0C7064" : "1px solid #D8D2BC",
                  background: choice === "custom" ? "#fff" : "transparent",
                  cursor: "pointer",
                  fontSize: 13.5,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="radio" name="intention-choice" checked={choice === "custom"} onChange={() => setChoice("custom")} />
                  <b style={{ color: "#1E3530" }}>自定义组合</b>
                </span>
                {choice === "custom" && (
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, marginLeft: 24, alignItems: "center" }}>
                    <select value={first} onChange={(e) => setFirst(e.target.value)} style={{ padding: "4px 6px", borderRadius: 8, border: "1px solid #D8D2BC" }}>
                      {FIRST_OPTS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    +
                    <select value={pick1} onChange={(e) => setPick1(e.target.value)} style={{ padding: "4px 6px", borderRadius: 8, border: "1px solid #D8D2BC" }}>
                      {SECOND_OPTS.filter((s) => s !== pick2).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    +
                    <select value={pick2} onChange={(e) => setPick2(e.target.value)} style={{ padding: "4px 6px", borderRadius: 8, border: "1px solid #D8D2BC" }}>
                      {SECOND_OPTS.filter((s) => s !== pick1).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </span>
                )}
              </label>
              {choice === "custom" && (
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="请填写自定义理由（至少 5 个字），如：孩子明确想报考公安类院校，需要选政治……"
                  rows={2}
                  style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #D8D2BC", fontSize: 13, resize: "vertical" }}
                />
              )}
              {submit.error && <p style={{ fontSize: 12.5, color: "#B4552D" }}>{submit.error.message}</p>}
              {submit.isSuccess && <p style={{ fontSize: 12.5, color: "#0C7064" }}>已提交，感谢确认。</p>}
              <button
                onClick={doSubmit}
                disabled={submit.isPending}
                style={{
                  justifySelf: "start",
                  padding: "9px 26px",
                  borderRadius: 12,
                  border: "none",
                  background: "#0C7064",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  opacity: submit.isPending ? 0.5 : 1,
                }}
              >
                {submit.isPending ? "提交中…" : "提交意向"}
              </button>
            </div>
          )}
        </>
      )}
      {mine.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px dashed #D8D2BC", paddingTop: 10 }}>
          <b style={{ fontSize: 12.5, color: "#1E3530" }}>历史意向</b>
          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
            {mine.map((m) => (
              <div key={m.roundNo} style={{ fontSize: 12.5, color: "#5B6B63" }}>
                第{m.roundNo}轮 · {CHOICE_LABEL[m.choice]} · <b style={{ color: "#1E3530" }}>{m.subjects.join("/")}</b>
                {m.reason ? `（${m.reason}）` : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
