import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563eb",
          foreground: "#ffffff"
        },
        canvas: "#0f172a",
        surface: "#111827"
      },
      boxShadow: {
        soft: "0 12px 30px -12px rgba(59, 130, 246, 0.25)"
      }
    }
  },
  plugins: []
};

export default config;
