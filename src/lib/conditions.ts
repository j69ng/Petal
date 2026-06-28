import { ConditionKey } from "./types";

export interface ConditionPreset {
  key: ConditionKey;
  label: string;
  blurb: string;
  symptoms: string[];
}

// Common, widely-documented symptoms associated with each condition.
// This is tracking content, not medical guidance — always paired with a
// reminder in the UI to bring patterns to a clinician.
export const CONDITIONS: ConditionPreset[] = [
  {
    key: "pcos",
    label: "PCOS",
    blurb: "Polycystic ovary syndrome",
    symptoms: [
      "Irregular cycle",
      "Fatigue",
      "Acne",
      "Hair growth changes",
      "Weight changes",
      "Mood swings",
      "Cravings",
      "Pelvic discomfort",
    ],
  },
  {
    key: "endometriosis",
    label: "Endometriosis",
    blurb: "Endometriosis & pelvic pain",
    symptoms: [
      "Pelvic pain",
      "Painful periods",
      "Bloating",
      "Fatigue",
      "Digestive upset",
      "Lower back pain",
      "Pain during activity",
      "Nausea",
    ],
  },
  {
    key: "fibromyalgia",
    label: "Fibromyalgia",
    blurb: "Fibromyalgia & widespread pain",
    symptoms: [
      "Widespread pain",
      "Fatigue",
      "Brain fog",
      "Sleep disruption",
      "Stiffness",
      "Headache",
      "Sensory sensitivity",
      "Mood changes",
    ],
  },
  {
    key: "autoimmune",
    label: "Autoimmune",
    blurb: "Autoimmune conditions (general)",
    symptoms: [
      "Joint pain",
      "Fatigue",
      "Skin flare",
      "Swelling",
      "Low-grade fever",
      "Brain fog",
      "Digestive upset",
      "Hair changes",
    ],
  },
  {
    key: "other",
    label: "Something else",
    blurb: "Track your own pattern",
    symptoms: ["Pain", "Fatigue", "Mood change", "Headache", "Nausea", "Flare"],
  },
];

export function getConditionSymptoms(keys: ConditionKey[]): string[] {
  const set = new Set<string>();
  keys.forEach((k) => {
    const preset = CONDITIONS.find((c) => c.key === k);
    preset?.symptoms.forEach((s) => set.add(s));
  });
  return Array.from(set);
}

export const BODY_REGIONS = [
  "head",
  "neck",
  "shoulders",
  "chest",
  "abdomen",
  "pelvis",
  "lower-back",
  "arms",
  "hands",
  "legs",
  "feet",
  "joints-general",
] as const;
