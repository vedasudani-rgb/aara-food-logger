import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#FBF7F0",
        accent: "#C4633A",
        positive: "#2D5016",
        text: "#3D3D3D",
      },
      fontFamily: {
        sans: ["Geist Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        base: ["16px", { lineHeight: "1.5" }],
      },
    },
  },
  plugins: [],
};

export default config;
