/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'pit-black': '#0E1012',
        'pit-grease': '#16191D',
        'pit-steel': '#21262D',
        'pit-rubber': '#2A313A',
        'hazard-orange': '#FF5500',
        'hazard-stripe': '#E04800',
        'neon-radio': '#00FF66',
        nitromethane: '#FFB800',
        'anodized-blue': '#00B4D8',
        'metal-border': '#3D444E',
        'metal-highlight': '#6B7280',
        'readout-bright': '#F9FAFB',
        'readout-dim': '#9CA3AF',
        'readout-muted': '#6B7280',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Share Tech Mono"', 'monospace'],
        display: ['"Barlow Condensed"', '"Chakra Petch"', 'sans-serif'],
        sans: ['"Inter"', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'beveled-panel':
          'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 4px 12px rgba(0, 0, 0, 0.5)',
        'neon-glow': '0 0 10px rgba(0, 255, 102, 0.4)',
        'hazard-glow': '0 0 12px rgba(255, 85, 0, 0.5)',
      },
    },
  },
  plugins: [],
};
