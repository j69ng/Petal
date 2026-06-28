"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BodyMap, { BodyMapValue } from "./BodyMap";
import { SymptomLog } from "@/lib/types";

interface LogFormProps {
  date: string; // YYYY-MM-DD
  availableSymptoms: string[];
  initialLog: SymptomLog | null;
}

export default function LogForm({ date, availableSymptoms, initialLog }: LogFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const initialSymptomMap: Record<string, number> = {};
  const initialBodyMap: BodyMapValue = {};
  initialLog?.entries.forEach((e) => {
    if (e.body_region) initialBodyMap[e.body_region] = e.severity;
    else initialSymptomMap[e.symptom_key] = e.severity;
  });

  const [symptomSeverity, setSymptomSeverity] = useState<Record<string, number>>(initialSymptomMap);
  const [bodyMap, setBodyMap] = useState<BodyMapValue>(initialBodyMap);
  const [mood, setMood] = useState<number>(initialLog?.mood ?? 5);
  const [energy, setEnergy] = useState<number>(initialLog?.energy ?? 5);
  const [sleepHours, setSleepHours] = useState<string>(initialLog?.sleep_hours?.toString() ?? "");
  const [notes, setNotes] = useState<string>(initialLog?.notes ?? "");

  function toggleSymptom(name: string) {
    setSymptomSeverity((prev) => {
      const next = { ...prev };
      if (name in next) delete next[name];
      else next[name] = 5;
      return next;
    });
  }

  function setSymptomLevel(name: string, severity: number) {
    setSymptomSeverity((prev) => ({ ...prev, [name]: severity }));
  }

  async function handleSave() {
    setSavedMessage(null);
    const entries = [
      ...Object.entries(symptomSeverity).map(([symptom_key, severity]) => ({
        symptom_key,
        severity,
        body_region: null,
      })),
      ...Object.entries(bodyMap).map(([body_region, severity]) => ({
        symptom_key: `Pain — ${body_region.replace("-", " ")}`,
        severity,
        body_region,
      })),
    ];

    const res = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        log_date: date,
        mood,
        energy,
        sleep_hours: sleepHours ? Number(sleepHours) : null,
        notes: notes || null,
        entries,
      }),
    });

    if (res.ok) {
      setSavedMessage("Saved.");
      startTransition(() => router.refresh());
    } else {
      setSavedMessage("Couldn't save — try again in a moment.");
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="eyebrow mb-3">Symptoms today</p>
        <div className="flex flex-wrap gap-2">
          {availableSymptoms.map((s) => {
            const active = s in symptomSeverity;
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSymptom(s)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  active ? "bg-bloom text-white border-bloom" : "border-mute-light hover:border-mute"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
        {Object.keys(symptomSeverity).length > 0 && (
          <div className="mt-4 space-y-3 max-w-md">
            {Object.entries(symptomSeverity).map(([name, severity]) => (
              <div key={name}>
                <label className="block text-sm mb-1" htmlFor={`sev-${name}`}>
                  {name} — {severity}/10
                </label>
                <input
                  id={`sev-${name}`}
                  type="range"
                  min={0}
                  max={10}
                  value={severity}
                  onChange={(e) => setSymptomLevel(name, Number(e.target.value))}
                  className="w-full accent-bloom"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="eyebrow mb-3">Where it shows up (optional)</p>
        <BodyMap value={bodyMap} onChange={setBodyMap} />
      </section>

      <section className="grid sm:grid-cols-3 gap-6 max-w-2xl">
        <div>
          <label className="block text-sm mb-1" htmlFor="mood">Mood — {mood}/10</label>
          <input
            id="mood"
            type="range"
            min={0}
            max={10}
            value={mood}
            onChange={(e) => setMood(Number(e.target.value))}
            className="w-full accent-gold"
          />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="energy">Energy — {energy}/10</label>
          <input
            id="energy"
            type="range"
            min={0}
            max={10}
            value={energy}
            onChange={(e) => setEnergy(Number(e.target.value))}
            className="w-full accent-sage"
          />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="sleep">Sleep (hours)</label>
          <input
            id="sleep"
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={sleepHours}
            onChange={(e) => setSleepHours(e.target.value)}
            placeholder="7.5"
            className="w-full border border-mute-light rounded-lg px-3 py-2 bg-white/60"
          />
        </div>
      </section>

      <section>
        <label className="block eyebrow mb-2" htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything that stood out today — meals, stress, weather, meds."
          className="w-full border border-mute-light rounded-xl px-3 py-2 bg-white/60"
        />
      </section>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="bg-bloom text-white px-6 py-2.5 rounded-full font-medium hover:bg-bloom-dark transition-colors disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save entry"}
        </button>
        {savedMessage && <span className="text-sm text-mute">{savedMessage}</span>}
      </div>
    </div>
  );
}
