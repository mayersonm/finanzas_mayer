import colors from 'tailwindcss/colors';
import formsPlugin from '@tailwindcss/forms';

const appColorScale = '(?:slate|gray|red|rose|orange|amber|yellow|green|emerald|cyan|sky|blue|violet|fuchsia)';
const appColorSteps = '(?:50|100|200|300|400|500|600|700|800|900|950)';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    transparent: 'transparent',
    current: 'currentColor',
    extend: {
      colors: {
        tremor: {
          brand: {
            faint: colors.emerald[50],
            muted: colors.emerald[200],
            subtle: colors.emerald[400],
            DEFAULT: colors.emerald[500],
            emphasis: colors.emerald[700],
            inverted: colors.white,
          },
          background: {
            muted: colors.gray[50],
            subtle: colors.gray[100],
            DEFAULT: colors.white,
            emphasis: colors.gray[700],
          },
          border: {
            DEFAULT: colors.gray[200],
          },
          ring: {
            DEFAULT: colors.gray[200],
          },
          content: {
            subtle: colors.gray[400],
            DEFAULT: colors.gray[500],
            emphasis: colors.gray[700],
            strong: colors.gray[900],
            inverted: colors.white,
          },
        },
        'dark-tremor': {
          brand: {
            faint: '#071f18',
            muted: colors.emerald[950],
            subtle: colors.emerald[800],
            DEFAULT: colors.emerald[500],
            emphasis: colors.emerald[400],
            inverted: colors.emerald[950],
          },
          background: {
            muted: '#101826',
            subtle: colors.gray[800],
            DEFAULT: '#151b26',
            emphasis: colors.gray[300],
          },
          border: {
            DEFAULT: colors.gray[800],
          },
          ring: {
            DEFAULT: colors.gray[800],
          },
          content: {
            subtle: colors.gray[600],
            DEFAULT: colors.gray[400],
            emphasis: colors.gray[200],
            strong: colors.gray[50],
            inverted: colors.gray[950],
          },
        },
      },
      boxShadow: {
        'tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.10), 0 1px 2px -1px rgb(0 0 0 / 0.10)',
        'tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10)',
        'dark-tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'dark-tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.12), 0 1px 2px -1px rgb(0 0 0 / 0.12)',
        'dark-tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.12), 0 2px 4px -2px rgb(0 0 0 / 0.12)',
      },
      borderRadius: {
        'tremor-small': '0.375rem',
        'tremor-default': '0.5rem',
        'tremor-full': '9999px',
      },
      fontSize: {
        'tremor-label': ['0.75rem', { lineHeight: '1rem' }],
        'tremor-default': ['0.875rem', { lineHeight: '1.25rem' }],
        'tremor-title': ['1.125rem', { lineHeight: '1.75rem' }],
        'tremor-metric': ['1.875rem', { lineHeight: '2.25rem' }],
      },
    },
  },
  safelist: [
    {
      pattern: new RegExp(`^(bg-${appColorScale}-${appColorSteps})$`),
      variants: ['hover', 'data-[selected]'],
    },
    {
      pattern: new RegExp(`^(text-${appColorScale}-${appColorSteps})$`),
      variants: ['hover', 'data-[selected]'],
    },
    {
      pattern: new RegExp(`^(border-${appColorScale}-${appColorSteps})$`),
      variants: ['hover', 'data-[selected]'],
    },
    {
      pattern: new RegExp(`^(ring-${appColorScale}-${appColorSteps})$`),
    },
    {
      pattern: new RegExp(`^(stroke-${appColorScale}-${appColorSteps})$`),
    },
    {
      pattern: new RegExp(`^(fill-${appColorScale}-${appColorSteps})$`),
    },
  ],
  plugins: [formsPlugin],
};
