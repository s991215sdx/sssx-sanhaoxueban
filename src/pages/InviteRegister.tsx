import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { QrCode } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { INVITE_GRADES } from "@contracts/invite";

/**
 * 邀请注册落地页（公开，扫码直达）：/invite/{渠道码}
 * 家长扫码 → 校验渠道码 → 录入基础信息（孩子姓名/年级/家长称呼/手机号/密码）→ 注册并直接登录 → 进入资料填写引导。
 * 三好学伴为邀请制，这是唯一的注册入口。
 */
export default function InviteRegister() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [studentName, setStudentName] = useState("");
  const [grade, setGrade] = useState("");
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");

  const info = trpc.invite.channelInfo.useQuery({ code }, { retry: false });
  const register = trpc.invite.registerWithInvite.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/", { replace: true });
    },
    onError: (err) => setError(err.message || "注册失败，请重试"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== password2) {
      setError("两次输入的密码不一样，再核对一下");
      return;
    }
    register.mutate({
      code,
      studentName: studentName.trim(),
      grade,
      parentName: parentName.trim(),
      phone: phone.trim(),
      password,
    });
  };

  const inputCls =
    "mt-1.5 w-full rounded-xl border border-olive/20 bg-cream/60 px-3.5 py-3 text-[15px] text-olive outline-none transition-colors placeholder:text-olive-mute/60 focus:border-lime";

  /* 渠道码校验中 / 无效 / 已停用 */
  if (info.isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-4">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        <p className="mono text-sm text-olive-mute">正在识别邀请二维码…</p>
      </div>
    );
  }
  if (info.error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4">
        <div className="paper-card w-full max-w-sm p-8 text-center">
          <QrCode className="mx-auto text-olive-mute" size={34} />
          <h1 className="mt-3 text-[19px] font-bold text-olive">二维码暂时用不了</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-mute">{info.error.message}</p>
          <Link to="/login" className="mt-5 block text-[13.5px] font-semibold text-olive underline underline-offset-4">
            已注册过？去登录 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-cream px-4 py-10">
      <div className="w-full max-w-sm">
        {/* 品牌区 */}
        <div className="flex flex-col items-center text-center">
          <svg width="56" height="56" viewBox="0 0 34 34" fill="none" aria-hidden>
            <rect x="1.5" y="1.5" width="31" height="31" rx="9" fill="#35421e" />
            <path d="M17 25c0-6.5 1.5-11 7-14-.5 6.5-2 11.5-7 14Z" fill="#9ccb52" />
            <path d="M17 25c0-6.5-1.5-11-7-14 .5 6.5 2 11.5 7 14Z" fill="#cfe07a" />
            <circle cx="17" cy="9.5" r="2.2" fill="#f9de81" />
          </svg>
          <h1 className="mt-3 text-[24px] font-bold tracking-tight text-olive">三好学伴 · 邀请注册</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-mute">
            你正在通过「{info.data?.name}」（{info.data?.kind}）渠道加入
          </p>
        </div>

        {/* 注册卡 */}
        <form onSubmit={submit} className="paper-card mt-6 p-6">
          <p className="text-[13px] leading-relaxed text-olive-mute">
            录入基础信息即可完成注册，接下来会引导你填写孩子资料并进入测评。
          </p>

          <label className="mt-4 block text-[13px] font-medium text-olive" htmlFor="studentName">
            孩子姓名
          </label>
          <input
            id="studentName"
            maxLength={32}
            placeholder="孩子的真实姓名"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            className={inputCls}
          />

          <label className="mt-4 block text-[13px] font-medium text-olive" htmlFor="grade">
            孩子年级
          </label>
          <select id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} className={inputCls}>
            <option value="">请选择年级</option>
            {INVITE_GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-[13px] font-medium text-olive" htmlFor="parentName">
            家长称呼
          </label>
          <input
            id="parentName"
            maxLength={32}
            placeholder="比如：乐乐妈妈 / 乐乐爸爸"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            className={inputCls}
          />

          <label className="mt-4 block text-[13px] font-medium text-olive" htmlFor="phone">
            手机号（登录账号）
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={11}
            placeholder="11 位手机号，用于以后登录"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            className={inputCls}
          />

          <label className="mt-4 block text-[13px] font-medium text-olive" htmlFor="password">
            设置密码
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            maxLength={64}
            placeholder="6～64 位"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
          <input
            type="password"
            autoComplete="new-password"
            maxLength={64}
            placeholder="再输一遍密码"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className={inputCls}
            aria-label="确认密码"
          />

          {error && <p className="mt-3 rounded-lg bg-terra/10 px-3 py-2 text-[13px] text-terra">{error}</p>}

          <button
            type="submit"
            disabled={
              register.isPending ||
              !studentName.trim() ||
              !grade ||
              !parentName.trim() ||
              phone.length !== 11 ||
              password.length < 6 ||
              password2.length < 6
            }
            className="mt-5 w-full rounded-xl bg-olive py-3.5 text-[16px] font-semibold text-cream transition-colors hover:bg-lime disabled:cursor-not-allowed disabled:opacity-50"
          >
            {register.isPending ? "注册中…" : "完成注册，开始使用"}
          </button>
          <p className="mt-3.5 text-center text-[12.5px] leading-relaxed text-olive-mute">
            注册即代表同意仅将以上信息用于学习服务；
            <br />
            <Link to="/login" className="font-semibold text-olive underline underline-offset-4">
              已注册过？直接登录
            </Link>
          </p>
        </form>

        <p className="mt-6 text-center mono text-[10.5px] tracking-wider text-olive-mute/70">好好学习 · 天天向上</p>
      </div>
    </div>
  );
}
