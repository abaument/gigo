/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark foundation
        espresso: '#0d0906',
        coffee: '#1a1310',
        roast: '#231a14',
        bark: '#2d231b',
        timber: '#3d3025',
        // Mid tones
        clay: '#5c4a3d',
        taupe: '#8b7355',
        sand: '#b8a089',
        // Highlights
        cream: '#f5efe6',
        ivory: '#faf8f4',
        // Accents
        amber: '#d4a853',
        gold: '#c9a227',
        copper: '#b87333',
        rust: '#a45a2a',
        terracotta: '#cc6b49',
        // Status colors
        sage: '#6b8e6b',
        coral: '#cd5c5c',
        sky: '#6b8fad',
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Source Code Pro', 'monospace'],
        accent: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(212, 168, 83, 0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(212, 168, 83, 0.03) 1px, transparent 1px)`,
        'glow-radial': 'radial-gradient(ellipse at center, rgba(212, 168, 83, 0.12) 0%, transparent 70%)',
        'grain': `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      },
      backgroundSize: {
        'grid': '60px 60px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(212, 168, 83, 0.2)' },
          '100%': { boxShadow: '0 0 40px rgba(212, 168, 83, 0.4)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
