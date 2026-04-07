export const colors = {   background: "#faf9f4",
  surface: "#ffffff",
  surfaceLow: "#f5f4ef",
  surfaceContainer: "#efeee9",
  surfaceHigh: "#e9e8e3",
  surfaceHighest: "#e3e3de",
  surfaceMuted: "#f7f5ef",
  primarySurface: "#edf5e9",
  secondarySurface: "#eef4ff",
  errorSurface: "#fff3f1",
  successSurface: "#f2f8ef",

  primary: "#002b02",
  primaryContainer: "#154212",
  onPrimary: "#ffffff",
  secondary: "#085ac0",
  secondaryContainer: "#d8e2ff",
  tertiary: "#5b2d00",
  tertiaryContainer: "#ffdcc4",

  textPrimary: "#1b1c19",
  textSecondary: "#42493e",
  textMuted: "#72796e",

  border: "#72796e",
  borderSubtle: "#c2c9bb",
  borderFaint: "#e7e3db",

  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  warning: "#5b2d00",
  warningContainer: "#ffdcc4",
  info: "#085ac0",
  infoContainer: "#d8e2ff",
  success: "#24501f",
  successContainer: "#bcf0ae",
  neutral: "#42493e",
  neutralContainer: "#efeee9"
} as const;

export const radius = {
  sm: "4px",
  md: "8px",
  lg: "16px",
  xl: "32px",
  full: "999px"
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "48px",
  "4xl": "56px",
  "5xl": "64px"
} as const;

export const shadows = {
  card: "0 20px 50px rgba(27, 28, 25, 0.08)",
  floating: "0 12px 28px rgba(27, 28, 25, 0.14)",
  inset: "inset 0 1px 0 rgba(255, 255, 255, 0.75)"
} as const;

export const typography = {
  displayFamily: "var(--font-display)",
  bodyFamily: "var(--font-body)"
} as const;

export const themeCssVariables = {
  "--pk-color-background": colors.background,
  "--pk-color-surface": colors.surface,
  "--pk-color-surface-low": colors.surfaceLow,
  "--pk-color-surface-container": colors.surfaceContainer,
  "--pk-color-surface-high": colors.surfaceHigh,
  "--pk-color-surface-highest": colors.surfaceHighest,
  "--pk-color-surface-muted": colors.surfaceMuted,
  "--pk-color-primary-surface": colors.primarySurface,
  "--pk-color-secondary-surface": colors.secondarySurface,
  "--pk-color-error-surface": colors.errorSurface,
  "--pk-color-success-surface": colors.successSurface,
  "--pk-color-primary": colors.primary,
  "--pk-color-primary-container": colors.primaryContainer,
  "--pk-color-on-primary": colors.onPrimary,
  "--pk-color-secondary": colors.secondary,
  "--pk-color-secondary-container": colors.secondaryContainer,
  "--pk-color-tertiary": colors.tertiary,
  "--pk-color-tertiary-container": colors.tertiaryContainer,
  "--pk-color-text-primary": colors.textPrimary,
  "--pk-color-text-secondary": colors.textSecondary,
  "--pk-color-text-muted": colors.textMuted,
  "--pk-color-border": colors.border,
  "--pk-color-border-subtle": colors.borderSubtle,
  "--pk-color-border-faint": colors.borderFaint,
  "--pk-color-error": colors.error,
  "--pk-color-error-container": colors.errorContainer,
  "--pk-color-warning": colors.warning,
  "--pk-color-warning-container": colors.warningContainer,
  "--pk-color-info": colors.info,
  "--pk-color-info-container": colors.infoContainer,
  "--pk-color-success": colors.success,
  "--pk-color-success-container": colors.successContainer,
  "--pk-color-neutral": colors.neutral,
  "--pk-color-neutral-container": colors.neutralContainer,
  "--pk-radius-sm": radius.sm,
  "--pk-radius-md": radius.md,
  "--pk-radius-lg": radius.lg,
  "--pk-radius-xl": radius.xl,
  "--pk-radius-full": radius.full,
  "--pk-shadow-card": shadows.card,
  "--pk-shadow-floating": shadows.floating,
  "--pk-shadow-inset": shadows.inset
} as const;

