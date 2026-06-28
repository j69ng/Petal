"use client";

import { useState } from "react";

export type BodyMapValue = Record<string, number>; // region id -> severity 0-10

interface Shape {
  type: "circle" | "rect" | "ellipse";
  [key: string]: any;
}

interface RegionDef {
  id: string;
  label: string;
  shapes: Shape[];
}

const REGIONS: RegionDef[] = [
  { id: "head", label: "Head", shapes: [{ type: "circle", cx: 100, cy: 40, r: 26 }] },
  { id: "neck", label: "Neck", shapes: [{ type: "rect", x: 90, y: 64, width: 20, height: 14, rx: 6 }] },
  { id: "shoulders", label: "Shoulders", shapes: [{ type: "ellipse", cx: 100, cy: 92, rx: 46, ry: 13 }] },
  { id: "chest", label: "Chest", shapes: [{ type: "rect", x: 68, y: 100, width: 64, height: 58, rx: 18 }] },
  { id: "abdomen", label: "Abdomen", shapes: [{ type: "rect", x: 72, y: 160, width: 56, height: 48, rx: 16 }] },
  { id: "pelvis", label: "Pelvis", shapes: [{ type: "rect", x: 70, y: 210, width: 60, height: 34, rx: 18 }] },
  {
    id: "arms",
    label: "Arms",
    shapes: [
      { type: "rect", x: 28, y: 100, width: 22, height: 108, rx: 11 },
      { type: "rect", x: 150, y: 100, width: 22, height: 108, rx: 11 },
    ],
  },
  {
    id: "hands",
    label: "Hands",
    shapes: [
      { type: "circle", cx: 39, cy: 220, r: 14 },
      { type: "circle", cx: 161, cy: 220, r: 14 },
    ],
  },
  {
    id: "legs",
    label: "Legs",
    shapes: [
      { type: "rect", x: 74, y: 246, width: 22, height: 108, rx: 11 },
      { type: "rect", x: 104, y: 246, width: 22, height: 108, rx: 11 },
    ],
  },
  {
    id: "feet",
    label: "Feet",
    shapes: [
      { type: "ellipse", cx: 85, cy: 366, rx: 16, ry: 10 },
      { type: "ellipse", cx: 115, cy: 366, rx: 16, ry: 10 },
    ],
  },
];

// Regions that don't map cleanly to a single front-view shape get a chip instead.
const EXTRA_REGIONS = [
  { id: "lower-back", label: "Lower back" },
  { id: "joints-general", label: "Joints (general)" },
];

function colorForSeverity(severity: number | undefined): { fill: string; stroke: string } {
  if (severity == null) return { fill: "#E4DEE6", stroke: "#A79BA8" };
  if (severity < 4) return { fill: "#A9C2AD", stroke: "#4F6E55" };
  if (severity < 7) return { fill: "#EBC97D", stroke: "#D9A441" };
  return { fill: "#E2A2B3", stroke: "#9C3C54" };
}

function renderShape(shape: Shape, key: string, fill: string, stroke: string, strokeWidth: number) {
  const common = { fill, stroke, strokeWidth };
  if (shape.type === "circle")
    return <circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} {...common} />;
  if (shape.type === "ellipse")
    return <ellipse key={key} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...common} />;
  return (
    <rect key={key} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} {...common} />
  );
}

interface BodyMapProps {
  value: BodyMapValue;
  onChange: (next: BodyMapValue) => void;
}

export default function BodyMap({ value, onChange }: BodyMapProps) {
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  function selectRegion(id: string) {
    setActiveRegion(id);
    if (!(id in value)) {
      onChange({ ...value, [id]: 5 });
    }
  }

  function setSeverity(id: string, severity: number) {
    onChange({ ...value, [id]: severity });
  }

  function removeRegion(id: string) {
    const next = { ...value };
    delete next[id];
    onChange(next);
    setActiveRegion(null);
  }

  const activeLabel =
    REGIONS.find((r) => r.id === activeRegion)?.label ??
    EXTRA_REGIONS.find((r) => r.id === activeRegion)?.label;

  return (
    <div className="flex flex-col sm:flex-row gap-6 items-start">
      <svg viewBox="0 0 200 390" width={200} height={390} className="shrink-0" role="group" aria-label="Body map">
        {REGIONS.map((region) => {
          const severity = value[region.id];
          const { fill, stroke } = colorForSeverity(severity);
          const isActive = activeRegion === region.id;
          return (
            <g
              key={region.id}
              role="button"
              tabIndex={0}
              aria-pressed={severity != null}
              aria-label={`${region.label}${severity != null ? `, severity ${severity}` : ""}`}
              onClick={() => selectRegion(region.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectRegion(region.id);
                }
              }}
              className="cursor-pointer focus-visible:outline-none"
              style={{ outline: "none" }}
            >
              {region.shapes.map((shape, i) =>
                renderShape(shape, `${region.id}-${i}`, fill, stroke, isActive ? 3 : 1.5)
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex-1 w-full">
        <p className="eyebrow mb-2">Where it shows up</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {EXTRA_REGIONS.map((r) => {
            const severity = value[r.id];
            const { fill, stroke } = colorForSeverity(severity);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => selectRegion(r.id)}
                style={{ backgroundColor: fill, borderColor: stroke }}
                className="text-sm px-3 py-1.5 rounded-full border font-body"
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {activeRegion ? (
          <div className="bg-white/60 border border-mute-light rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-lg">{activeLabel}</span>
              <button
                type="button"
                onClick={() => removeRegion(activeRegion)}
                className="text-sm text-bloom-dark underline"
              >
                Remove
              </button>
            </div>
            <label className="block text-sm text-mute mb-1" htmlFor="severity-range">
              Severity — {value[activeRegion] ?? 5}/10
            </label>
            <input
              id="severity-range"
              type="range"
              min={0}
              max={10}
              value={value[activeRegion] ?? 5}
              onChange={(e) => setSeverity(activeRegion, Number(e.target.value))}
              className="w-full accent-bloom"
            />
          </div>
        ) : (
          <p className="text-mute text-sm">Tap a region on the figure, or a chip above, to log severity there.</p>
        )}

        {Object.keys(value).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(value).map(([id, severity]) => {
              const label = REGIONS.find((r) => r.id === id)?.label ?? EXTRA_REGIONS.find((r) => r.id === id)?.label ?? id;
              const { fill, stroke } = colorForSeverity(severity);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveRegion(id)}
                  style={{ backgroundColor: fill, borderColor: stroke }}
                  className="text-xs px-2.5 py-1 rounded-full border font-mono"
                >
                  {label} · {severity}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
