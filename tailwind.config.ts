import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070b0f",
          900: "#0b1117",
          800: "#121a22",
          700: "#1b2733",
        },
        accent: {
          DEFAULT: "#22d3ee",
          dim: "#0e7490",
        },
      },
    },
  },
  plugins: [],
};

export default config;
