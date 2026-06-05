// Visual brand gradients. NOT theme tokens — these encode visual identity
// (type colors, rank medals, image overlays, section tints). Pair with
// `gradient2(c1, c2)` / `gradient3(c1, c2, c3)` helpers to keep angle/format
// consistent. Pure hex values are intentional: visual identity, not theme
// state. Compose from theme tokens (`primary.main`, `ACCENT.purple.main`) when
// the color should follow theme.

import { ACCENT } from './accents';

export const gradient2 = (a: string, b: string) =>
  `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;

export const gradient3 = (a: string, b: string, c: string, mid = 50) =>
  `linear-gradient(135deg, ${a} 0%, ${b} ${mid}%, ${c} 100%)`;

// Content-type cover gradients (used in home/recommend and content routes)
export const TYPE_GRADIENT: Record<string, string> = {
  NOVEL: gradient2('#FE2C55', '#FF6B8A'),
  VIDEO: gradient2('#25F4EE', '#5DF7F2'),
  MUSIC: gradient2(ACCENT.purple.main, '#C4B5FD'),
  ARTICLE: gradient2('#FFB400', '#FFD566'),
  PICTURE_ALBUM: gradient2('#5DDB96', '#25F4EE'),
  LIVE: gradient2('#FE2C55', '#FFB400'),
  FILM: gradient2(ACCENT.purple.main, '#FE2C55'),
  TELEPLAY: gradient2(ACCENT.orange.main, '#FF6B8A'),
  ANIMATION: gradient2('#5DDB96', '#25F4EE'),
  COMICS: gradient2(ACCENT.blue.main, ACCENT.purple.main),
  VSHOW: gradient2('#FE2C55', '#FFB400'),
  NEWS: gradient2('#C5C8D6', '#8B8FA3'),
};

// Top-3 leaderboard rank badges (gold/silver/bronze implied by hue warmth).
// RANK_BG goes on top-3 list-item badges; MEDAL goes on the podium card itself.
export const RANK_BG: Record<number, string> = {
  1: gradient2('#FF3B5C', '#FF6B8A'),
  2: gradient2(ACCENT.orange.main, '#FFB066'),
  3: gradient2('#FFB400', '#FFD566'),
};

// Top-3 muted rank pill (gold/silver/bronze with cooler, more metallic palette).
// Used on list rows that show rank 1/2/3 — keeps the leaderboard subtle.
export const RANK_PILL: Record<number, string> = {
  1: gradient2('#FFD700', '#FFB400'),
  2: gradient2('#C0C0C0', '#8B8FA3'),
  3: gradient2('#CD7F32', '#A0531D'),
};

// Gold/silver/bronze medal cards (used in podium-style leaderboards)
export const MEDAL_GOLD = {
  bg: 'linear-gradient(135deg, rgba(255, 215, 0, 0.25) 0%, rgba(255, 180, 0, 0.15) 100%)',
  border: 'rgba(255, 215, 0, 0.5)',
  badge: gradient2('#FFD700', '#FFA500'),
  txt: '#3a1a00',
};
export const MEDAL_SILVER = {
  bg: 'linear-gradient(135deg, rgba(220, 220, 220, 0.2) 0%, rgba(180, 180, 180, 0.1) 100%)',
  border: 'rgba(220, 220, 220, 0.4)',
  badge: gradient2('#E0E0E0', '#B0B0B0'),
  txt: '#1a1a1a',
};
export const MEDAL_BRONZE = {
  bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.2) 0%, rgba(180, 90, 30, 0.1) 100%)',
  border: 'rgba(205, 127, 50, 0.4)',
  badge: gradient2('#CD7F32', '#8B4513'),
  txt: '#fff',
};
export const MEDAL: Record<number, typeof MEDAL_GOLD> = {
  1: MEDAL_GOLD,
  2: MEDAL_SILVER,
  3: MEDAL_BRONZE,
};

// Image overlay masks (for darkening photos so text on top is readable).
// `start` = where the dark gradient begins, `peak` = max alpha at bottom.
export const IMAGE_OVERLAY = {
  // Heavy — typical cover-art mask, 30% transparent at top
  HEAVY: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.85) 100%)',
  // Mid — for card thumbnails with title at bottom
  MID: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.85) 100%)',
  // Light — subtle bottom shade
  LIGHT: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.6) 100%)',
  // Top — dark gradient at top (used for badges sitting on top-left)
  TOP_BAR: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.85) 100%)',
  // Cover fade — for video poster at top
  TO_TOP: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
};

// Section-level brand-tinted backgrounds (3-color, 8% alpha — for page
// section tints behind card grids). Picks one of three brand color sets
// rotated across panels.
export const SECTION_TINT = {
  PRIMARY_PURPLE: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(37, 244, 238, 0.06) 50%, rgba(254, 44, 85, 0.08) 100%)',
  RED_PURPLE_YELLOW: 'linear-gradient(135deg, rgba(254, 44, 85, 0.08) 0%, rgba(139, 92, 246, 0.06) 50%, rgba(255, 180, 0, 0.08) 100%)',
  RED_YELLOW_PURPLE: 'linear-gradient(135deg, rgba(254, 44, 85, 0.08) 0%, rgba(255, 180, 0, 0.06) 50%, rgba(139, 92, 246, 0.08) 100%)',
  RED_CYAN: 'linear-gradient(135deg, rgba(254, 44, 85, 0.08) 0%, rgba(37, 244, 238, 0.05) 100%)',
  RED_PURPLE: 'linear-gradient(135deg, rgba(254, 44, 85, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
  RED_CYAN_STRONG: 'linear-gradient(135deg, rgba(254, 44, 85, 0.12) 0%, rgba(37, 244, 238, 0.05) 100%)',
};

// 3-color theme gradients (135deg) — for activity/event/celebration covers.
// Use gradient3(a, b, c, mid?) helper for ad-hoc variants; these are the
// specific combinations that recur in mock data and component presets.
export const THEME_GRADIENT = {
  RED_PINK_YELLOW: gradient3('#FE2C55', '#FF6B8A', '#FFB400'),
  RED_PINK_YELLOW_60: gradient3('#FE2C55', '#FF6B8A', '#FFB400', 60),
  CYAN_PURPLE: gradient3('#25F4EE', '#5DF7F2', '#8B5CF6'),
  CYAN_YELLOW_60: gradient3('#25F4EE', '#5DF7F2', '#FFB400', 60),
  YELLOW_RED_PURPLE: gradient3('#FFB400', '#FE2C55', '#8B5CF6'),
  YELLOW_LIGHT_RED_60: gradient3('#FFB400', '#FFD566', '#FE2C55', 60),
  PURPLE_CYAN_60: gradient3('#8B5CF6', '#C4B5FD', '#25F4EE', 60),
  RED_YELLOW_CYAN: gradient3('#FE2C55', '#FFB400', '#25F4EE'),
};

// 90deg CTA / button accents
export const CTA_GRADIENT = {
  RED_YELLOW: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
  YELLOW_RED: 'linear-gradient(90deg, #FFB400 0%, #FE2C55 100%)',
};

// Dark page/section background gradients (deep blues + purples — for hero
// sections on dark-themed pages like account/reward)
export const DARK_BG = {
  PURPLE_BLUE: 'linear-gradient(135deg, #161821 0%, #1E1B2E 50%, #1A1F2E 100%)',
  DEEP_NIGHT: 'linear-gradient(135deg, #1A0F18 0%, #0A0B14 60%, #0F1A1E 100%)',
};
