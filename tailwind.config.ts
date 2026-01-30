import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#b9e5fe",
          300: "#7cd4fd",
          400: "#36bffa",
          500: "#0ca5eb",
          600: "#0086c9",
          700: "#016aa3",
          800: "#065986",
          900: "#0b4a6f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
