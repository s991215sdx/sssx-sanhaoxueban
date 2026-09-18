import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";

/** 登录页：手机号 + 密码。邀请制注册——没有账号的家长需扫描管理员发放的注册二维码（/invite/{code}）完成注册。 */
export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.loginPhone.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/", { replace: true });
    },
    onError: (err) => {
      setError(err.message || "登录失败，请重试");
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ phone: phone.trim(), password });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm">
        {/* 品牌区 */}
        <div className="flex flex-col items-center text-center">
          <svg width="64" height="64" viewBox="0 0 34 34" fill="none" aria-hidden>
            <rect x="1.5" y="1.5" width="31" height="31" rx="9" fill="#35421e" />
            <path d="M17 25c0-6.5 1.5-11 7-14-.5 6.5-2 11.5-7 14Z" fill="#9ccb52" />
            <path d="M17 25c0-6.5-1.5-11-7-14 .5 6.5 2 11.5 7 14Z" fill="#cfe07a" />
            <circle cx="17" cy="9.5" r="2.2" fill="#f9de81" />
          </svg>
          <h1 className="mt-4 text-[26px] font-bold tracking-tight text-olive">三好学伴</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-olive-mute">
            先预习 · 勤查漏 · 会复盘
            <br />
            你的 K12 个性化学习伙伴
          </p>
        </div>

        {/* 登录卡 */}
        <form onSubmit={submit} className="paper-card mt-8 p-6">
          <label className="block text-[13px] font-medium text-olive" htmlFor="phone">
            手机号
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={11}
            placeholder="请输入 11 位手机号"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            className="mt-1.5 w-full rounded-xl border border-olive/20 bg-cream/60 px-3.5 py-3 text-[15px] text-olive outline-none transition-colors placeholder:text-olive-mute/60 focus:border-lime"
          />

          <label className="mt-4 block text-[13px] font-medium text-olive" htmlFor="password">
            密码
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            maxLength={64}
            placeholder="6～64 位"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-olive/20 bg-cream/60 px-3.5 py-3 text-[15px] text-olive outline-none transition-colors placeholder:text-olive-mute/60 focus:border-lime"
          />

          {error && (
            <p className="mt-3 rounded-lg bg-terra/10 px-3 py-2 text-[13px] text-terra">{error}</p>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending || phone.length !== 11 || password.length < 6}
            className="mt-5 w-full rounded-xl bg-olive py-3.5 text-[16px] font-semibold text-cream transition-colors hover:bg-lime disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loginMutation.isPending ? "正在进入…" : "进入三好学伴"}
          </button>
          <p className="mt-3.5 text-center text-[12.5px] leading-relaxed text-olive-mute">
            还没有账号？三好学伴采用邀请制注册——
            <br />
            请向管理员或老师索取<b className="text-olive">注册二维码</b>，扫码填写信息后注册。
          </p>
        </form>

        <p className="mt-6 text-center mono text-[10.5px] tracking-wider text-olive-mute/70">
          好好学习 · 天天向上
        </p>
      </div>
    </div>
  );
}
