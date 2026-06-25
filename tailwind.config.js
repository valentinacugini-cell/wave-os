/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        wave: {
          teal: '#7DF5DF',
          tealDark: '#3DD4BE',
          navy: '#1A1A2E',
          navyLight: '#252545',
          dark: '#333333',
          gray: '#666666',
          grayLight: '#E0E0E0',
          bg: '#F8F9FA',
          red: '#E53935',
          redLight: '#FFEBEE',
          yellow: '#F9A825',
          yellowLight: '#FFFDE7',
          green: '#43A047',
          greenLight: '#E8F5E9',
          blue: '#4F86C6',
          blueLight: '#E3F0FF',
          orange: '#E07B54',
          purple: '#A67DC6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
