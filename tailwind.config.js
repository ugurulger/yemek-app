/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Fraunces_600SemiBold'],
        sans: ['Outfit_400Regular'],
        'sans-medium': ['Outfit_500Medium'],
      },
    },
  },
  plugins: [],
};
