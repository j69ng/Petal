import { SymptomLog } from "./types";

export interface Insight {
  id: string;
  headline: string;
  detail: string;
}

/**
 * Looks for simple, descriptive patterns in the user's own logged data.
 * This intentionally stays statistical and descriptive — it never
 * diagnoses, predicts, or recommends treatment. The dashboard always
 * pairs these with a reminder to discuss patterns with a clinician.
 */
export function generateInsights(logs: SymptomLog[]): Insight[] {
  const insights: Insight[] = [];
  if (logs.length < 5) {
    return [
      {
        id: "more-data",
        headline: "Keep logging",
        detail: "A few more entries will start to surface patterns worth a second look.",
      },
    ];
  }

  // Most frequently logged symptom
  const counts = new Map<string, number>();
  logs.forEach((log) =>
    log.entries.forEach((e) => counts.set(e.symptom_key, (counts.get(e.symptom_key) ?? 0) + 1))
  );
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0) {
    const [topSymptom, count] = sorted[0];
    insights.push({
      id: "top-symptom",
      headline: `${topSymptom} shows up most often`,
      detail: `Logged on ${count} of your last ${logs.length} entries.`,
    });
  }

  // Sleep vs. average severity, comparing nights under and at/over 6 hours
  const withSleep = logs.filter((l) => l.sleep_hours != null);
  if (withSleep.length >= 5) {
    const avgSeverity = (group: SymptomLog[]) => {
      const sevs = group.flatMap((l) => l.entries.map((e) => e.severity));
      return sevs.length ? sevs.reduce((a, b) => a + b, 0) / sevs.length : null;
    };
    const lowSleep = withSleep.filter((l) => (l.sleep_hours ?? 0) < 6);
    const okSleep = withSleep.filter((l) => (l.sleep_hours ?? 0) >= 6);
    const lowAvg = avgSeverity(lowSleep);
    const okAvg = avgSeverity(okSleep);
    if (lowAvg != null && okAvg != null && lowSleep.length >= 3 && okSleep.length >= 3) {
      const diff = lowAvg - okAvg;
      if (diff >= 1) {
        insights.push({
          id: "sleep-severity",
          headline: "Shorter nights track with rougher days",
          detail: `Average severity is about ${diff.toFixed(1)} points higher on days following under 6 hours of sleep.`,
        });
      }
    }
  }

  // Recent streak
  const last7 = logs.slice(0, 7);
  if (last7.length === 7) {
    insights.push({
      id: "streak",
      headline: "7-day logging streak",
      detail: "Consistent tracking makes patterns much easier to trust.",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "no-pattern-yet",
      headline: "Nothing strongly stands out yet",
      detail: "That's normal — patterns tend to emerge over a few weeks of entries.",
    });
  }

  return insights;
}
