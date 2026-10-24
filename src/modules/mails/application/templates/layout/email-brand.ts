// Mirrors the PM SHOW design tokens (frontend-pmshow/src/app/globals.css) so
// transactional emails match the app: military dark green header, the
// band's gold in the logo, PM green for the action button.
export const EMAIL_BRAND = {
  pageBackground: "#f3f0e8",
  surface: "#ffffff",
  cardBackground: "#f8f5ee",
  headerBackground: "#0e1610",
  /** Logo "SHOW" on the dark header. */
  gold: "#d1a12a",
  /** Call-to-action button. */
  accent: "#1e5235",
  accentSoft: "#f6ecd0",
  danger: "#b03a30",
  dangerSoft: "#fbeae7",
  border: "#e2dccf",
  text: "#1b1c17",
  textMuted: "#5c5547",
  textSoft: "#8f8775",
  white: "#ffffff",
  headerText: "#f2ecdd",
} as const;
