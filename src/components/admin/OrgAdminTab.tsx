import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Building2, Plus, Power, KeyRound, PencilLine, X } from "lucide-react";

type OrgRow = {
  id: number;
  name: string;
  brandName: string;
  logoUrl: string | null;
  active: boolean;
  createdAt: Date;
  studentCount: number;
  tutorCount: number;
  adminCount: number;
  admin: { id: number; phone: string | null; name: string | null; lastSignInAt: Date } | null;
};

/** 总系统（平台超管）：开通/管理合作机构的独立三好学伴系统。 */
export default function OrgAdminTab() {
  const { data: orgs, isLoading } = trpc.org.list.useQuery();
  const [creating, setCreating] = useState(false);
  const [editOrg, setEditOrg] = useState<OrgRow | null>(null);
  const [resetOrg, setResetOrg] = useState<OrgRow | null>(null);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-olive">机构管理</h1>
        <p className="mt-1 text-[13px] text-olive-mute">
          总系统：为每个合作机构开通一套独立的三好学伴——机构用自己的商标和名称，自建管理员与伴学师账号，数据彼此隔离。
        </p>
      </header>

      <div className="flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-xl bg-olive px-4 py-2.5 text-[13.5px] font-semibold text-cream transition-colors hover:bg-lime"
        >
          <Plus size={16} /> 开通机构
        </button>
      </div>

      {isLoading ? (
        <div className="paper-card flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {(orgs ?? []).map((o) => (
            <div key={o.id} className={`paper-card overflow-hidden ${o.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-3.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-pale text-olive">
                  <Building2 size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold text-olive">{o.brandName}</span>
                    {!o.active && <span className="chip !py-0.5 !text-[10.5px] text-terra">已停用</span>}
                  </div>
                  <div className="mt-0.5 text-[12px] text-olive-mute">{o.name}</div>
                </div>
                <div className="mono text-[12px] text-olive-soft">
                  学员 {o.studentCount} · 伴学师 {o.tutorCount} · 管理员 {o.adminCount}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditOrg(o)}
                    className="flex items-center gap-1 rounded-lg border border-border bg-cream px-3 py-1.5 text-[12.5px] font-medium text-olive hover:border-lime"
                  >
                    <PencilLine size={13} /> 编辑品牌
                  </button>
                  <button
                    onClick={() => setResetOrg(o)}
                    className="flex items-center gap-1 rounded-lg border border-border bg-cream px-3 py-1.5 text-[12.5px] font-medium text-olive hover:border-lime"
                  >
                    <KeyRound size={13} /> 重置管理员密码
                  </button>
                  <SetActiveButton org={o} />
                </div>
              </div>
              <div className="px-5 py-3 text-[12.5px] text-olive-mute">
                管理员账号：{o.admin?.phone ?? "未设置"}
                {o.admin?.name ? `（${o.admin.name}）` : ""}
                <span className="mono ml-2 text-[11px]">
                  最近登录 {o.admin ? new Date(o.admin.lastSignInAt).toLocaleDateString("zh-CN") : "—"}
                </span>
              </div>
            </div>
          ))}
          {(orgs ?? []).length === 0 && (
            <p className="paper-card px-5 py-10 text-center text-[13px] text-olive-mute">还没有机构，点右上角「开通机构」创建第一套。</p>
          )}
        </div>
      )}

      {creating && <CreateOrgModal onClose={() => setCreating(false)} />}
      {editOrg && <EditOrgModal org={editOrg} onClose={() => setEditOrg(null)} />}
      {resetOrg && <ResetAdminModal org={resetOrg} onClose={() => setResetOrg(null)} />}
    </div>
  );
}

function SetActiveButton({ org }: { org: OrgRow }) {
  const utils = trpc.useUtils();
  const setActive = trpc.org.setActive.useMutation({
    onSuccess: () => utils.org.list.invalidate(),
  });
  return (
    <button
      onClick={() => setActive.mutate({ id: org.id, active: !org.active })}
      disabled={setActive.isPending}
      className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-40 ${
        org.active
          ? "border-terra/30 bg-cream text-terra hover:border-terra"
          : "border-lime bg-lime-pale text-olive hover:border-olive/40"
      }`}
    >
      <Power size={13} /> {org.active ? "停用" : "启用"}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-olive/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-cream p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-olive">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-olive-mute hover:bg-lime-pale hover:text-olive">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-cream px-3.5 py-2.5 text-[14px] text-olive outline-none placeholder:text-olive-mute/60 focus:border-lime";

function CreateOrgModal({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const create = trpc.org.create.useMutation({
    onSuccess: async () => {
      await utils.org.list.invalidate();
      onClose();
    },
  });

  return (
    <Modal title="开通机构" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-olive">机构全称</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="如：东莞上上升学教育咨询有限公司" />
        </div>
        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-olive">品牌名（商标）</label>
          <input className={inputCls} value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="如：上上升学 · 三好伴学" />
          <p className="mt-1 text-[11.5px] text-olive-mute">机构登录后全站显示该名称。</p>
        </div>
        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-olive">品牌 Logo URL（可选）</label>
          <input className={inputCls} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="border-t border-border pt-3">
          <div className="mb-2 text-[12.5px] font-semibold text-olive">机构管理员账号</div>
          <div className="space-y-3">
            <input className={inputCls} value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="称呼（可空，默认「机构管理员」）" />
            <input className={inputCls} value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} placeholder="手机号（登录账号）" />
            <input className={inputCls} type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="初始密码（6～64 位）" />
          </div>
        </div>
        {create.error && <p className="text-[12.5px] text-terra">{create.error.message}</p>}
        <button
          onClick={() => create.mutate({ name, brandName, logoUrl, adminName, adminPhone, adminPassword })}
          disabled={create.isPending}
          className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
        >
          {create.isPending ? "开通中…" : "开通机构系统"}
        </button>
      </div>
    </Modal>
  );
}

function EditOrgModal({ org, onClose }: { org: OrgRow; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(org.name);
  const [brandName, setBrandName] = useState(org.brandName);
  const [logoUrl, setLogoUrl] = useState(org.logoUrl ?? "");
  const update = trpc.org.update.useMutation({
    onSuccess: async () => {
      await utils.org.list.invalidate();
      onClose();
    },
  });

  return (
    <Modal title={`编辑品牌 · ${org.brandName}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-olive">机构全称</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-olive">品牌名（商标）</label>
          <input className={inputCls} value={brandName} onChange={(e) => setBrandName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-olive">品牌 Logo URL</label>
          <input className={inputCls} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="留空则不显示 Logo" />
        </div>
        {update.error && <p className="text-[12.5px] text-terra">{update.error.message}</p>}
        <button
          onClick={() => update.mutate({ id: org.id, name, brandName, logoUrl })}
          disabled={update.isPending}
          className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
        >
          {update.isPending ? "保存中…" : "保存"}
        </button>
      </div>
    </Modal>
  );
}

function ResetAdminModal({ org, onClose }: { org: OrgRow; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const reset = trpc.org.resetAdminPassword.useMutation({
    onSuccess: () => setDone(true),
  });

  return (
    <Modal title={`重置管理员密码 · ${org.brandName}`} onClose={onClose}>
      {done ? (
        <p className="text-[13.5px] leading-relaxed text-olive">已重置。请把新密码转告机构管理员，建议首次登录后修改。</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[12.5px] text-olive-mute">
            管理员账号：{org.admin?.phone ?? "未设置"}。重置后旧密码立即失效。
          </p>
          <input
            className={inputCls}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新密码（6～64 位）"
          />
          {reset.error && <p className="text-[12.5px] text-terra">{reset.error.message}</p>}
          <button
            onClick={() => reset.mutate({ id: org.id, password })}
            disabled={reset.isPending}
            className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
          >
            {reset.isPending ? "重置中…" : "确认重置"}
          </button>
        </div>
      )}
    </Modal>
  );
}
