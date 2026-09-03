/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1E3A8A',
          blueHover: '#1e40af',
          blueLight: '#EFF6FF',
        },
        primary: {
          DEFAULT: '#1E3A8A',
          hover: '#1e40af',
          light: '#EFF6FF',
          dark: '#0f172a',
        },
        accent: {
          DEFAULT: '#16a34a',
          hover: '#15803d',
          light: '#dcfce7',
        },
        danger: {
          DEFAULT: '#dc2626',
          hover: '#b91c1c',
          light: '#fee2e2',
        },
        warning: {
          DEFAULT: '#d97706',
          light: '#fef3c7',
        },
        purple: {
          DEFAULT: '#7c3aed',
          light: '#ede9fe',
        },
        bgBody: '#F3F4F6',
        bgCard: '#FFFFFF',
        borderCustom: '#E5E7EB',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
      },
      boxShadow: {
        lux: '0 20px 30px -5px rgba(30, 58, 138, 0.09), 0 8px 12px -6px rgba(30, 58, 138, 0.05)',
      }
    },
  },
  plugins: [],
}
