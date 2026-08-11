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
        // Anciens noms de classe conserves pour ne rien casser dans le code
        // existant — seules les valeurs changent, palette Ping verrouillee.
        navy:   '#123644', // etait #1A1033 (violet Nexto)
        accent: '#12B39C', // etait #7C5CFC (violet Nexto)
        'accent-d': '#0C8F7E',
        'accent-l': '#E3F5F2',
        cream:  '#F3F6F5', // etait #F0EDE8
        ok:     '#12B39C',
        warn:   '#F2A93B',
        danger: '#FF7A66',
      },
      fontFamily: {
        // Meme logique : les classes font-fredoka / font-nunito restent
        // utilisees dans tout le code, seule la police chargee change.
        fredoka: ['var(--font-quicksand)', 'sans-serif'],
        nunito:  ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
