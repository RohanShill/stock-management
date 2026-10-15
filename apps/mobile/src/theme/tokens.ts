/**
 * Design Tokens for Hardware Store Mobile App
 * Clean, calm, accessible, mobile-first design system
 */

export const colors = {
  // Brand / Primary (Deep Navy & Slate Indigo)
  primary: '#1E3A8A', // Deep corporate navy
  primaryHover: '#1E40AF',
  primaryLight: '#EFF6FF',
  primaryBorder: '#BFDBFE',

  // Secondary Accents
  accent: '#0284C7', // Slate cyan
  accentLight: '#F0F9FF',

  // Neutrals / Backgrounds
  background: '#F8FAFC', // Crisp light slate background
  surface: '#FFFFFF', // Pure white cards & modals
  surfaceSubtle: '#F1F5F9', // Subtle secondary container
  border: '#E2E8F0', // Light slate border
  borderStrong: '#CBD5E1', // Focused / defined borders

  // Typography
  textPrimary: '#0F172A', // Slate 900 for high-contrast readability
  textSecondary: '#475569', // Slate 600 for subtitles and labels
  textMuted: '#94A3B8', // Slate 400 for placeholders and hints
  textInverse: '#FFFFFF',

  // Functional / Status
  success: '#16A34A', // Green 600
  successBg: '#F0FDF4',
  successLight: '#DCFCE7',
  successBorder: '#BBF7D0',

  warning: '#D97706', // Amber 600
  warningBg: '#FFFBEB',
  warningLight: '#FEF3C7',
  warningBorder: '#FDE68A',

  danger: '#DC2626', // Red 600
  dangerBg: '#FEF2F2',
  dangerLight: '#FEE2E2',
  dangerBorder: '#FECACA',
  error: '#DC2626',
  errorBg: '#FEF2F2',
  errorLight: '#FEE2E2',
  errorBorder: '#FECACA',

  info: '#2563EB', // Blue 600
  infoBg: '#EFF6FF',
  infoLight: '#DBEAFE',
  infoBorder: '#BFDBFE',
};

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
  // Convenience scales
  fontSize: {
    title: 20,
    subtitle: 16,
    body: 14,
    caption: 12,
    small: 11,
  },
  fontWeight: {
    bold: '700' as const,
    semibold: '600' as const,
    medium: '500' as const,
    normal: '400' as const,
  },

  // Mobile-first type scale objects
  titleLarge: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  titleMedium: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
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
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
};
