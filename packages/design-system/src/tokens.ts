export const palette = {
  graphite: '#111827',
  turquoise: '#18D6D1',
  blue: '#0A6CFF',
  celadon: '#A4D9BB',
  bubblegumPink: '#F86E8F',
  darkTeal: '#033438',
} as const;

export const theme = {
  colorBackground: palette.graphite,
  colorSurface: '#1B2436',
  colorText: '#E7ECF5',
  colorAccent: palette.turquoise,
  colorAccentAlt: palette.blue,
  colorSpecial: palette.bubblegumPink,
  radius: '10px',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
} as const;
