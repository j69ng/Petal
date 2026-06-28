import { getDaysInMonth, format, parseISO } from "date-fns";
import Link from "next/link";
import { SymptomLog } from "@/lib/types";

interface BloomCalendarProps {
  month: Date;
  logs: SymptomLog[];
  size?: number;
}

interface DaySummary {
  day: number;
  dateStr: string;
  avgSeverity: number | null;
  topSymptoms: string[];
}

function summarizeDay(log: SymptomLog | undefined): { avg: number | null; top: string[] } {
  if (!log || log.entries.length === 0) return { avg: null, top: [] };
  const avg = log.entries.reduce((sum, e) => sum + e.severity, 0) / log.entries.length;
  const top = [...log.entries]
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 2)
    .map((e) => e.symptom_key);
  return { avg, top };
}

function colorFor(avg: number | null): { fill: string; stroke: string } {
  if (avg == null) return { fill: "#E4DEE6", stroke: "#A79BA8" };
  if (avg < 4) return { fill: "#A9C2AD", stroke: "#4F6E55" }; // sage — mild
  if (avg < 7) return { fill: "#EBC97D", stroke: "#D9A441" }; // gold — moderate
  return { fill: "#E2A2B3", stroke: "#9C3C54" }; // bloom — significant
}

function petalPath(innerR: number, len: number, w: number) {
  const yBase = -innerR;
  const yTip = -innerR - len;
  const mid = yBase - len * 0.35;
  return `M 0,${yBase} C ${-w},${mid} ${-w * 0.6},${yTip} 0,${yTip} C ${w * 0.6},${yTip} ${w},${mid} 0,${yBase} Z`;
}

export default function BloomCalendar({ month, logs, size = 320 }: BloomCalendarProps) {
  const daysInMonth = getDaysInMonth(month);
  const monthPrefix = format(month, "yyyy-MM");
  const cx = size / 2;
  const cy = size / 2;
  const innerR = size * 0.16;
  const maxLen = size * 0.27;
  const minLen = size * 0.045;

  const byDate = new Map<string, SymptomLog>();
  logs.forEach((l) => byDate.set(l.log_date, l));

  const days: DaySummary[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateStr = `${monthPrefix}-${String(day).padStart(2, "0")}`;
    const { avg, top } = summarizeDay(byDate.get(dateStr));
    return { day, dateStr, avgSeverity: avg, topSymptoms: top };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={`Bloom calendar for ${format(month, "MMMM yyyy")}`}
    >
      <circle cx={cx} cy={cy} r={innerR - 4} fill="#FBF7F4" stroke="#E4DEE6" strokeWidth={1} />
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        className="fill-ink"
        style={{ fontFamily: "var(--font-fraunces)", fontSize: size * 0.07 }}
      >
        {format(month, "MMM")}
      </text>
      <text
        x={cx}
        y={cy + size * 0.06}
        textAnchor="middle"
        className="fill-mute"
        style={{ fontFamily: "var(--font-plex-mono)", fontSize: size * 0.03, letterSpacing: "0.08em" }}
      >
        {days.filter((d) => d.avgSeverity != null).length}/{daysInMonth} LOGGED
      </text>

      {days.map((d, i) => {
        const angleDeg = (360 / daysInMonth) * i - 90;
        const len = d.avgSeverity == null ? minLen : minLen + (d.avgSeverity / 10) * (maxLen - minLen);
        const w = d.avgSeverity == null ? 5 : 6 + d.avgSeverity * 0.7;
        const { fill, stroke } = colorFor(d.avgSeverity);
        const title =
          d.avgSeverity == null
            ? `${format(parseISO(d.dateStr), "MMM d")} — no entry`
            : `${format(parseISO(d.dateStr), "MMM d")} — ${d.topSymptoms.join(", ")}`;

        return (
          <Link key={d.dateStr} href={`/dashboard/log?date=${d.dateStr}`} aria-label={title}>
            <g
              transform={`translate(${cx}, ${cy}) rotate(${angleDeg})`}
              className="animate-bloomIn"
              style={{ animationDelay: `${i * 12}ms`, transformOrigin: "0 0" }}
            >
              <title>{title}</title>
              <path d={petalPath(innerR, len, w)} fill={fill} stroke={stroke} strokeWidth={1} />
            </g>
          </Link>
        );
      })}
    </svg>
  );
}
