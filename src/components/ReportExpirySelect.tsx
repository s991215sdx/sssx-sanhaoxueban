import { useState } from "react";

/** v169：报告权限有效期选择——永久（默认）/30 天/半年/1 年/自定义截止日期。返回 ISO 字符串或 null。 */
export type ExpiryValue = string | null; // null=永久；否则为截止 ISO 日期

const OPTIONS = [
  { v: "forever", label: "永久" },
  { v: "30d", label: "30 天" },
  { v: "halfyear", label: "半年" },
  { v: "1y", label: "1 年" },
  { v: "custom", label: "自定义截止日" },
] as const;

function addDays(n: number): string {
  const d = new Date(Date.now() + n * 86400_000);
  return d.toISOString();
}

/** 从既有 expiresAt 反推当前档位（自定义日期不认识的都归 custom） */
export function expiryPresetOf(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "forever";
  return "custom";
}

export default function ReportExpirySelect({
  value,
  onChange,
  compact = false,
}: {
  value: ExpiryValue;
  onChange: (iso: ExpiryValue) => void;
  compact?: boolean;
}) {
  const preset = expiryPresetOf(value);
  const [customDate, setCustomDate] = useState(() => (value ? value.slice(0, 10) : ""));
  const cls = compact
    ? "rounded border border-border bg-cream px-1.5 py-0.5 text-[11px] text-olive"
    : "rounded-lg border border-border bg-cream px-2 py-1 text-[12px] text-olive";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <select
        className={cls}
        value={preset}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "forever") onChange(null);
          else if (v === "30d") onChange(addDays(30));
          else if (v === "halfyear") onChange(addDays(183));
          else if (v === "1y") onChange(addDays(365));
          else onChange(customDate ? new Date(customDate + "T23:59:59").toISOString() : null);
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
      {preset === "custom" && (
        <input
          type="date"
          className={cls}
          value={customDate}
          onChange={(e) => {
            setCustomDate(e.target.value);
            if (e.target.value) onChange(new Date(e.target.value + "T23:59:59").toISOString());
          }}
        />
      )}
    </span>
  );
}
