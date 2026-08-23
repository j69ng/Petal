import Link from "next/link";
import type { Verdict } from "@/lib/variance";

export function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-4 px-4 py-3 border-b border-line">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {subtitle && <p className="text-xs text-mute mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "plain" | "ok" | "warn" | "alert";
}) {
  const toneClass =
    tone === "alert" ? "text-alert" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-ink";
  return (
    <div className="card px-4 py-3">
      <div className="label">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {note && <div className="text-xs text-mute mt-1 leading-snug">{note}</div>}
    </div>
  );
}

const VERDICT_STYLE: Record<Verdict | "high" | "medium" | "low", string> = {
  alert: "bg-alert/10 text-alert border-alert/30",
  watch: "bg-warn/10 text-warn border-warn/30",
  ok: "bg-ok/10 text-ok border-ok/30",
  cheaper: "bg-ok/10 text-ok border-ok/30",
  new: "bg-line/60 text-mute border-line",
  high: "bg-alert/10 text-alert border-alert/30",
  medium: "bg-warn/10 text-warn border-warn/30",
  low: "bg-line/60 text-mute border-line",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  alert: "Overcharged",
  watch: "Worth asking",
  ok: "Fair",
  cheaper: "Cheaper",
  new: "No baseline",
};

export function Pill({ kind, children }: { kind: Verdict | "high" | "medium" | "low"; children?: React.ReactNode }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${VERDICT_STYLE[kind]}`}>
      {children ?? VERDICT_LABEL[kind as Verdict] ?? kind}
    </span>
  );
}

export function Empty({ children, action }: { children: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-mute">
      <p>{children}</p>
      {action && (
        <Link href={action.href} className="btn mt-4">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-mute mt-1">{hint}</span>}
    </label>
  );
}
