import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slatebg: "#0f172a",
        panel: "#111827",
        cyanaccent: "#22d3ee",
      },
    },
  },
  plugins: [],
} satisfies Config;
