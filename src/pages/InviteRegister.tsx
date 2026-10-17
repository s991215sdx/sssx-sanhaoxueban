import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { QrCode, GraduationCap } from "lucide-react";
import { trpc } from "@/providers/trpc";

/**
 * 邀请注册落地页（公开，扫码直达）：/invite/{渠道码}
 * 家长扫码 → 校验渠道码 → 只填手机号 + 密码即完成注册并直接登录 → 进入测评中心。
 * 三好学伴为邀请制，这是唯一的注册入口。V51 起不再要求姓名/年级等资料。
 * v191 校园模式：校园渠道只填 姓名 + 班级 + 年级（学校随渠道固定，免手机号免密码）。
 */
export default function InviteRegister() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");

  const info = trpc.invite.channelInfo.useQuery({ code }, { retry: false });

  /* 渠道码校验中 / 无效 / 已停用 */
  if (info.isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-4">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        <p className="mono text-sm text-olive-mute">正在识别邀请二维码…</p>
      </div>
    );
  }
  if (info.error || !info.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4">
        <div className="paper-card w-full max-w-sm p-8 text-center">
          <QrCode className="mx-auto text-olive-mute" size={34} />
          <h1 className="mt-3 text-[19px] font-bold text-olive">二维码暂时用不了</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-mute">{info.error?.message ?? "二维码无效"}</p>
          <Link to="/login" className="mt-5 block text-[13.5px] font-semibold text-olive underline underline-offset-4">
            已注册过？去登录 →
          </Link>
        </div>
      </div>
    );
  }

  /* v191 校园模式：学校专用入口（免手机号，只填姓名+班级+年级） */
  if (info.data.campus) {
    return <CampusRegister code={code} school={info.data.org?.name ?? ""} brandName={info.data.org?.brandName ?? ""} logoUrl={info.data.org?.logoUrl ?? null} />;
  }

  return <PhoneRegister code={code} navigate={navigate} utils={utils} phone={phone} setPhone={setPhone} password={password} setPassword={setPassword} password2={password2} setPassword2={setPassword2} error={error} setError={setError} />;
}

/* ---------------- 校园模式注册（v191） ---------------- */
function CampusRegister({ code, school, brandName, logoUrl }: { code: string; school: string; brandName: string; logoUrl: string | null }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [grade, setGrade] = useState("高一");
  const [error, setError] = useState("");

  const register = trpc.invite.registerCampus.useMutation({
    onSuccess: async (res) => {
      await utils.invalidate();
      void res;
      navigate("/assessments", { replace: true });
    },
    onError: (err) => setError(err.message || "进入失败，请重试"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    register.mutate({ code, name: name.trim(), className: className.trim(), grade });
  };

  const inputCls =
    "mt-1.5 w-full rounded-xl border border-olive/20 bg-cream/60 px-3.5 py-3 text-[15px] text-olive outline-none transition-colors placeholder:text-olive-mute/60 focus:border-lime";

  return (
    <div className="flex min-h-screen flex-col items-center bg-cream px-4 py-10">
      <div className="w-full max-w-sm">
        {/* 学校品牌区 */}
        <div className="flex flex-col items-center text-center">
          {logoUrl ? (
            <img src={logoUrl} alt={school || "学校标识"} className="h-20 w-20 rounded-2xl object-contain shadow-sm" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <GraduationCap size={40} />
            </span>
          )}
          <h1 className="mt-3 text-[22px] font-bold tracking-tight text-olive">
            {brandName || school || "校园生涯测评"}
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-mute">
            {school ? <>{school} · 生涯规划测评系统</> : "生涯规划测评系统"}
            <br />
            填写姓名和班级即可进入，无需手机号。
          </p>
        </div>

        <form onSubmit={submit} className="paper-card mt-6 p-6">
          <label className="block text-[13px] font-medium text-olive" htmlFor="stu-name">
            姓名<span className="text-terra"> *</span>
          </label>
          <input
            id="stu-name"
            maxLength={32}
            autoComplete="name"
            placeholder="你的真实姓名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />

          <label className="mt-4 block text-[13px] font-medium text-olive" htmlFor="stu-class">
            班级<span className="text-terra"> *</span>
          </label>
          <select
            id="stu-class"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className={`${inputCls} appearance-none bg-cream/60`}
          >
            <option value="" disabled>
              请选择班级
            </option>
            {Array.from({ length: 11 }, (_, i) => `${i + 1}班`).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-[13px] font-medium text-olive">年级</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(["高一", "高二", "高三"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrade(g)}
                className={`rounded-xl border px-3 py-2.5 text-[14.5px] font-semibold transition ${
                  grade === g ? "border-transparent bg-brand text-cream" : "border-olive/20 bg-cream/60 text-olive hover:border-lime"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {error && <p className="mt-3 rounded-lg bg-terra/10 px-3 py-2 text-[13px] text-terra">{error}</p>}

          <button
            type="submit"
            disabled={register.isPending || name.trim().length < 2 || !className.trim()}
            className="mt-5 w-full rounded-xl bg-brand py-3.5 text-[16px] font-semibold text-cream transition-colors hover:bg-lime disabled:cursor-not-allowed disabled:opacity-50"
          >
            {register.isPending ? "进入中…" : "进入测评"}
          </button>
          <p className="mt-3.5 text-center text-[12.5px] leading-relaxed text-olive-mute">
            填过的姓名+班级会直接进入你的账号（无需密码）；
            <br />
            班里如有同名同学，请在姓名后加数字区分，如「张三2」。
          </p>
        </form>

        <p className="mt-6 text-center mono text-[10.5px] tracking-wider text-olive-mute/70">好好学习 · 天天向上</p>
      </div>
    </div>
  );
}

/* ---------------- 手机号注册（原有流程，v51 极简） ---------------- */
function PhoneRegister(props: {
  code: string;
  navigate: (path: string, opt?: { replace?: boolean }) => void;
  utils: ReturnType<typeof trpc.useUtils>;
  phone: string; setPhone: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  password2: string; setPassword2: (v: string) => void;
  error: string; setError: (v: string) => void;
}) {
  const { code, navigate, utils, phone, setPhone, password, setPassword, password2, setPassword2, error, setError } = props;
  const register = trpc.invite.registerWithInvite.useMutation({
    onSuccess: async (res) => {
      await utils.invalidate();
      /* v181e：注册成功统一落到测评中心，由学员自己选「学习力测评 / 选科及升学规划测评 / 更多测评」；
         不再自动进入渠道套餐连测队列（queue 深链仍保留给伴学师推送等场景手动使用）。 */
      void res;
      navigate("/assessments", { replace: true });
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
    register.mutate({ code, phone: phone.trim(), password });
  };

  const inputCls =
    "mt-1.5 w-full rounded-xl border border-olive/20 bg-cream/60 px-3.5 py-3 text-[15px] text-olive outline-none transition-colors placeholder:text-olive-mute/60 focus:border-lime";

  return (
    <div className="flex min-h-screen flex-col items-center bg-cream px-4 py-10">
      <div className="w-full max-w-sm">
        {/* 品牌区 */}
        <div className="flex flex-col items-center text-center">
          <svg width="56" height="56" viewBox="0 0 34 34" fill="none" aria-hidden>
            <rect x="1.5" y="1.5" width="31" height="31" rx="9" fill="#1E3530" />
            <path d="M17 25c0-6.5 1.5-11 7-14-.5 6.5-2 11.5-7 14Z" fill="#8EBD86" />
            <path d="M17 25c0-6.5-1.5-11-7-14 .5 6.5 2 11.5 7 14Z" fill="#CDE3CC" />
            <circle cx="17" cy="9.5" r="2.2" fill="#FCCE45" />
          </svg>
          <h1 className="mt-3 text-[24px] font-bold tracking-tight text-olive">三好学伴 · 邀请注册</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-mute">
            加入之后，你将获得<b className="text-olive">价值 2980 元的学习力系统测评</b>一份，
            <br />
            全面测评了解孩子的系统学习力。
          </p>
        </div>

        {/* 注册卡：V51 起只填手机号 + 密码 */}
        <form onSubmit={submit} className="paper-card mt-6 p-6">
          <p className="text-[13px] leading-relaxed text-olive-mute">输入手机号和密码即可完成注册，注册后直接进入测评中心。</p>

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
            disabled={register.isPending || phone.length !== 11 || password.length < 6 || password2.length < 6}
            className="mt-5 w-full rounded-xl bg-brand py-3.5 text-[16px] font-semibold text-cream transition-colors hover:bg-lime disabled:cursor-not-allowed disabled:opacity-50"
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
