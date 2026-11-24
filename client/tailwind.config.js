/**
 * Mana Tenali design tokens (spec section 11, sampled from the green UI reference).
 * Primary green ~#15803D, pressed ~#166534, mint surfaces ~#ECF8EC.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F2FBF2',
          100: '#ECF8EC',
          200: '#D3F0D6',
          300: '#A9E0B0',
          400: '#6CC47A',
          500: '#2FA24A',
          600: '#1E8E3E',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
        },
        ink: {
          DEFAULT: '#0F1F14',
          muted: '#4B5B50',
          soft: '#6B7A70',
        },
        status: {
          traffic: '#EA580C',
          trafficBg: '#FFEDD5',
          weather: '#2563EB',
          weatherBg: '#DBEAFE',
          event: '#E11D48',
          eventBg: '#FFE4E6',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans"', '"Noto Sans Telugu"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
        tile: '20px',
      },
      boxShadow: {
        card: '0 2px 10px rgba(21, 128, 61, 0.08), 0 1px 2px rgba(15, 31, 20, 0.04)',
        lift: '0 8px 24px rgba(21, 128, 61, 0.18)',
        nav: '0 -4px 20px rgba(15, 31, 20, 0.08)',
      },
      backgroundImage: {
        'mint-page': 'linear-gradient(180deg, #ECF8EC 0%, #F7FCF7 45%, #FFFFFF 100%)',
        'header-green':
          'linear-gradient(180deg, #15803D 0%, #1E8E3E 45%, #4DB463 78%, #CDEFD2 100%)',
        'banner-green': 'linear-gradient(100deg, #166534 0%, #15803D 45%, #2FA24A 100%)',
        'explore-mint': 'linear-gradient(180deg, #DDF3DF 0%, #ECF8EC 40%, #E3F5E5 100%)',
      },
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
      maxWidth: { app: '40rem' },
    },
  },
  plugins: [],
};
