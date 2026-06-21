import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy:   '#1A1033',
        accent: '#7C5CFC',
        'accent-d': '#5538D4',
        'accent-l': '#EDE8FF',
        cream:  '#F0EDE8',
        ok:     '#22C55E',
        warn:   '#FB923C',
        danger: '#EF4444',
      },
      fontFamily: {
        fredoka: ['Fredoka One', 'cursive'],
        nunito:  ['Nunito', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
