"use client";

import { CONDITIONS } from "@/lib/conditions";
import { ConditionKey } from "@/lib/types";

interface ConditionPickerProps {
  value: ConditionKey[];
  onChange: (next: ConditionKey[]) => void;
}

export default function ConditionPicker({ value, onChange }: ConditionPickerProps) {
  function toggle(key: ConditionKey) {
    if (value.includes(key)) {
      onChange(value.filter((k) => k !== key));
    } else {
      onChange([...value, key]);
    }
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {CONDITIONS.map((c) => {
        const selected = value.includes(c.key);
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => toggle(c.key)}
            aria-pressed={selected}
            className={`text-left p-4 rounded-2xl border transition-colors ${
              selected ? "border-bloom bg-bloom-light/30" : "border-mute-light hover:border-mute"
            }`}
          >
            <p className="font-display text-lg">{c.label}</p>
            <p className="text-sm text-mute">{c.blurb}</p>
          </button>
        );
      })}
    </div>
  );
}
