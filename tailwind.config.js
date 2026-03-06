// PATH: tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
      },
      colors: {
        brand: {
          green: "#16A34A",
          greenLight: "#22C55E",
          blue: "#050E1F",
          blueMid: "#0A1628",
        },
      },
    },
  },
  plugins: [],
};