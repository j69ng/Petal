"use client";

import { useState } from "react";
import { MATERIALS, material } from "@/lib/materials";

/**
 * Material and unit travel together — picking "cement" should fill in "bag
 * (50kg)" without anyone typing it, because a unit typed two different ways is
 * what breaks a rate comparison later.
 */
export default function MaterialSelect({
  defaultKey = "cement",
  className = "",
}: {
  defaultKey?: string;
  className?: string;
}) {
  const [key, setKey] = useState(defaultKey);
  const [unit, setUnit] = useState(material(defaultKey).unit);

  return (
    <>
      <label className={`block ${className}`}>
        <span className="label">Material</span>
        <select
          name="material_key"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setUnit(material(e.target.value).unit);
          }}
          className="input"
        >
          {MATERIALS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Unit</span>
        <input name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="input" />
      </label>
    </>
  );
}
