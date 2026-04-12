import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        bg: {
          DEFAULT: "var(--color-bg)",
          subtle: "var(--color-bg-subtle)",
          elevated: "var(--color-bg-elevated)",
        },
        ink: {
          DEFAULT: "var(--color-ink)",
          muted: "var(--color-ink-muted)",
          faint: "var(--color-ink-faint)",
        },
        line: {
          DEFAULT: "var(--color-line)",
          strong: "var(--color-line-strong)",
        },
        brand: {
          DEFAULT: "var(--color-brand)",
          strong: "var(--color-brand-strong)",
          muted: "#2a3f5a",
        },
        accent: {
          DEFAULT: "#f4b860",
          warn: "#f87171",
          ok: "#4ade80",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        serif: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "Times", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        soft: "var(--color-shadow-soft)",
      },
    },
  },
  plugins: [],
};

export default config;
