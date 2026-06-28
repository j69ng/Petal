"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format, parseISO } from "date-fns";
import { SymptomLog } from "@/lib/types";

interface TrendChartProps {
  logs: SymptomLog[]; // expected oldest -> newest
}

export default function TrendChart({ logs }: TrendChartProps) {
  const data = logs.map((log) => {
    const avgSeverity = log.entries.length
      ? log.entries.reduce((sum, e) => sum + e.severity, 0) / log.entries.length
      : null;
    return {
      date: format(parseISO(log.log_date), "MMM d"),
      severity: avgSeverity != null ? Math.round(avgSeverity * 10) / 10 : null,
      mood: log.mood,
      energy: log.energy,
    };
  });

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#E4DEE6" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontFamily: "var(--font-plex-mono)", fontSize: 11, fill: "#A79BA8" }}
            axisLine={{ stroke: "#E4DEE6" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fontFamily: "var(--font-plex-mono)", fontSize: 11, fill: "#A79BA8" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              fontFamily: "var(--font-karla)",
              borderRadius: 12,
              border: "1px solid #E4DEE6",
            }}
          />
          <Line type="monotone" dataKey="severity" name="Symptom severity" stroke="#C2516B" strokeWidth={2.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="mood" name="Mood" stroke="#D9A441" strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="energy" name="Energy" stroke="#6B8F71" strokeWidth={1.5} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
