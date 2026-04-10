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
          DEFAULT: "#0b0d10",
          subtle: "#11141a",
          elevated: "#151923",
        },
        ink: {
          DEFAULT: "#e7ecf3",
          muted: "#9aa4b2",
          faint: "#6b7280",
        },
        line: {
          DEFAULT: "#1f2430",
          strong: "#2a3040",
        },
        brand: {
          DEFAULT: "#7cc4ff",
          strong: "#4aa3ff",
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
        soft: "0 1px 2px rgba(0,0,0,0.3), 0 4px 20px rgba(0,0,0,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
