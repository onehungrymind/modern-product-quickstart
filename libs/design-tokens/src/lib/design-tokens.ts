/**
 * CSS custom property helpers for Tracer design tokens.
 * Import tokens.css globally; use these helpers for JS-driven styling if needed.
 */
export const designTokens = {
  surface0: 'var(--surface-0)',
  surface1: 'var(--surface-1)',
  surface2: 'var(--surface-2)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textDisabled: 'var(--text-disabled)',
  accent: 'var(--accent)',
  accentHover: 'var(--accent-hover)',
  error: 'var(--error)',
  spacingXs: 'var(--spacing-xs)',
  spacingSm: 'var(--spacing-sm)',
  spacingMd: 'var(--spacing-md)',
  spacingLg: 'var(--spacing-lg)',
  spacingXl: 'var(--spacing-xl)',
  radiusSm: 'var(--radius-sm)',
  radiusMd: 'var(--radius-md)',
  radiusLg: 'var(--radius-lg)',
  fontSans: 'var(--font-sans)',
} as const;
