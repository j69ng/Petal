import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FBF7F4",        // warm paper, pink-tinted (not cliché cream)
        ink: "#2B2630",       // deep plum-black, not pure black
        bloom: {
          DEFAULT: "#C2516B", // dusty rose / berry — primary, higher severity
          light: "#E2A2B3",
          dark: "#9C3C54",
        },
        sage: {
          DEFAULT: "#6B8F71", // muted sage — calm, mild severity
          light: "#A9C2AD",
          dark: "#4F6E55",
        },
        gold: {
          DEFAULT: "#D9A441", // warm gold — moderate severity, accents
          light: "#EBC97D",
        },
        mute: {
          DEFAULT: "#A79BA8", // lavender-grey — borders, no-log states
          light: "#E4DEE6",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-karla)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      borderRadius: {
        petal: "2rem 0.5rem 2rem 0.5rem",
      },
      keyframes: {
        bloomIn: {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        bloomIn: "bloomIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
