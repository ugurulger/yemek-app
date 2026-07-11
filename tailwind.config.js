/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Newsreader_500Medium'],
        sans: ['HankenGrotesk_400Regular'],
        'sans-medium': ['HankenGrotesk_500Medium'],
        'sans-semibold': ['HankenGrotesk_600SemiBold'],
      },
      colors: {
        // Birincil orman yeşili
        forest: {
          DEFAULT: '#1F4A3D',
          dark: '#2E5F4E',
        },
        // Zeminler
        cream: '#F7F5F0',
        sand: '#EDEAE3',
        // Metin tonları
        ink: '#23302B',
        body: '#3A463F',
        muted: '#8A9088',
        muted2: '#96A199',
        // Amber (eksik/rozet)
        amber: {
          DEFAULT: '#E38A2A',
          text: '#B26A16',
          soft: '#FBE6C9',
        },
        // Şef tüyosu kutusu
        cheftip: {
          bg: '#EFEAD9',
          title: '#8A6B1F',
          text: '#5C5230',
        },
        // Makro noktaları
        macro: {
          protein: '#1F4A3D',
          karb: '#E38A2A',
          yag: '#C9A24B',
        },
        // Buzdolabı kategori pastel tint'leri
        tint: {
          sut: '#F3DEE4',
          et: '#F7E0D6',
          sebze: '#E5EEDD',
          diger: '#F4ECCB',
        },
        // Tarif etiketi (market)
        recipetag: {
          bg: '#F6EFE7',
          text: '#A9846B',
        },
        // Yumuşak yeşil sayaç pili ("N tarif") + asistan ikon zemini
        softgreen: {
          bg: '#DCEEE3',
          text: '#2E7D5B',
        },
        // Soluk yeşil pill zemini (makrolar, stepper −, mic idle)
        pillbg: '#EFF3EC',
        // Malzeme miktar/kcal metni
        qtymuted: '#98A29A',
        // İşaretlenmiş satır metni (market)
        checkedtext: '#A9B0AB',
        // Tab bar pasif rengi
        tabinactive: '#B4BBB4',
      },
    },
  },
  plugins: [],
};
