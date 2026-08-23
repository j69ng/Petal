import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1b1a17",
        mute: "#6f6a61",
        line: "#e4e0d8",
        paper: "#fbfaf7",
        card: "#ffffff",
        brand: "#8a5a2b",
        brandsoft: "#f3e9dd",
        ok: "#2f7a4d",
        warn: "#b7791f",
        alert: "#b3261e",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
