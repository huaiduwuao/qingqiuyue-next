// Domain-level accent colors. These are NOT theme tokens (those live in
// src/styles/theme.ts and src/styles/creatorTheme.ts as primary/secondary/etc).
// Accent colors encode per-domain semantics — user, AI, level, collaboration,
// anime, romance — that don't fit the standard palette. Use when a single
// feature needs to distinguish sub-categories: taskboard column colors, role
// badges, category chips, sub-section highlights. Pair `main` with the pre-mixed
// `soft` / `border` transparencies to avoid hand-rolling rgba() at the call site.

export const ACCENT = {
  purple: {
    main: '#8B5CF6',
    soft12: 'rgba(139, 92, 246, 0.12)',
    soft18: 'rgba(139, 92, 246, 0.18)',
    border30: 'rgba(139, 92, 246, 0.3)',
  },
  blue: {
    main: '#5B8DEF',
    soft12: 'rgba(91, 141, 239, 0.12)',
    soft18: 'rgba(91, 141, 239, 0.18)',
    border30: 'rgba(91, 141, 239, 0.3)',
  },
  orange: {
    main: '#FF8A3D',
    soft12: 'rgba(255, 138, 61, 0.12)',
    soft18: 'rgba(255, 138, 61, 0.18)',
    border30: 'rgba(255, 138, 61, 0.3)',
  },
  cyan: {
    main: '#06B6D4',
    soft12: 'rgba(6, 182, 212, 0.12)',
    soft18: 'rgba(6, 182, 212, 0.18)',
    border30: 'rgba(6, 182, 212, 0.3)',
  },
  gold: {
    main: '#D4AF37',
    soft12: 'rgba(212, 175, 55, 0.12)',
    soft18: 'rgba(212, 175, 55, 0.18)',
    border30: 'rgba(212, 175, 55, 0.3)',
  },
  red: {
    main: '#E0264B',
    soft12: 'rgba(224, 38, 75, 0.12)',
    soft18: 'rgba(224, 38, 75, 0.18)',
    border30: 'rgba(224, 38, 75, 0.3)',
  },
} as const;

export type AccentName = keyof typeof ACCENT;
