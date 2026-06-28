import { Insight } from "@/lib/insights";

export default function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="border border-mute-light rounded-2xl p-4 bg-white/60">
      <p className="font-display text-lg leading-snug">{insight.headline}</p>
      <p className="text-sm text-mute mt-1">{insight.detail}</p>
    </div>
  );
}
