/**
 * Design Tokens for Hardware Store Mobile App
 * Premium, modern, mobile-first design system
 * Enhanced with gradients, refined palette, and richer shadows
 */

export const colors = {
  // Brand / Primary (Vibrant Indigo → Ocean Blue)
  primary: '#4F46E5',        // Indigo 600 – more vibrant, premium
  primaryHover: '#4338CA',
  primaryLight: '#EEF2FF',   // Indigo 50
  primaryBorder: '#C7D2FE',  // Indigo 200

  // Secondary Accents (Teal → Cyan)
  accent: '#0891B2',         // Cyan 600
  accentLight: '#ECFEFF',    // Cyan 50

  // Neutrals / Backgrounds
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  // Typography
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  // Functional / Status
  success: '#059669',        // Emerald 600
  successBg: '#ECFDF5',
  successLight: '#D1FAE5',
  successBorder: '#A7F3D0',

  warning: '#D97706',
  warningBg: '#FFFBEB',
  warningLight: '#FEF3C7',
  warningBorder: '#FDE68A',

  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  dangerLight: '#FEE2E2',
  dangerBorder: '#FECACA',
  error: '#DC2626',
  errorBg: '#FEF2F2',
  errorLight: '#FEE2E2',
  errorBorder: '#FECACA',

  info: '#2563EB',
  infoBg: '#EFF6FF',
  infoLight: '#DBEAFE',
  infoBorder: '#BFDBFE',

  // Gradient endpoints (for cards, headers)
  gradientStart: '#4F46E5',
  gradientEnd: '#7C3AED',
};

export const lightColors = colors;

export const darkColors = {
  // Brand / Primary
  primary: '#818CF8',        // Indigo 400 – bright for dark BG
  primaryHover: '#A5B4FC',
  primaryLight: '#1E1B4B',   // Deep indigo bg
  primaryBorder: '#6366F1',

  // Secondary Accents
  accent: '#22D3EE',         // Cyan 400
  accentLight: '#083344',

  // Neutrals / Backgrounds
  background: '#0C0F1A',     // Very deep navy
  surface: '#141826',        // Slightly elevated card
  surfaceSubtle: '#1C2035',  // Muted section bg
  surfaceElevated: '#1E2340',
  border: '#252A3A',
  borderStrong: '#3B4050',

  // Typography
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0F172A',

  // Functional / Status
  success: '#34D399',        // Emerald 400
  successBg: '#064E3B',
  successLight: '#065F46',
  successBorder: '#059669',

  warning: '#FBBF24',
  warningBg: '#451A03',
  warningLight: '#78350F',
  warningBorder: '#D97706',

  danger: '#F87171',         // Red 400
  dangerBg: '#450A0A',
  dangerLight: '#7F1D1D',
  dangerBorder: '#DC2626',
  error: '#F87171',
  errorBg: '#450A0A',
  errorLight: '#7F1D1D',
  errorBorder: '#DC2626',

  info: '#60A5FA',
  infoBg: '#172554',
  infoLight: '#1E3A8A',
  infoBorder: '#2563EB',

  gradientStart: '#6366F1',
  gradientEnd: '#8B5CF6',
};

export function getThemeColors(isDarkMode: boolean) {
  return isDarkMode ? darkColors : colors;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const typography = {
  // Font family – use system fonts but prefer modern ones
  fontFamily: undefined as string | undefined, // Will use platform default (San Francisco / Roboto)

  // Convenience scales
  fontSize: {
    hero: 28,
    title: 20,
    subtitle: 16,
    body: 14,
    caption: 12,
    small: 11,
    tiny: 10,
  },
  fontWeight: {
    black: '900' as const,
    bold: '700' as const,
    semibold: '600' as const,
    medium: '500' as const,
    normal: '400' as const,
  },

  // Mobile-first type scale objects
  heroLarge: {
    fontSize: 28,
    fontWeight: '800' as const,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  titleLarge: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  titleMedium: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  titleSmall: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  bodyLarge: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  labelLarge: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  labelMedium: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 14,
    color: colors.textMuted,
  },
  currencyLarge: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 30,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  currencyMedium: {
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 24,
    color: colors.textPrimary,
  },
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHover: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const darkShadows = {
  none: shadows.none,
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHover: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
};

export function getThemeShadows(isDarkMode: boolean) {
  return isDarkMode ? darkShadows : shadows;
}
