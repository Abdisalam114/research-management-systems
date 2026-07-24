/** Shared chart / dashboard colors — matches design-tokens.css */
export const DASH_COLORS = Object.freeze({
  accent: "#0ea5e9",
  accentSoft: "#38bdf8",
  accentStrong: "#0284c7",
  success: "#16a34a",
  successSoft: "#22c55e",
  warning: "#f59e0b",
  warningSoft: "#fbbf24",
  danger: "#ef4444",
  muted: "#94a3b8",
  slate: "#334155",
  surface: "#0f172a",
  card: "#1e293b",
  text: "#f8fafc",
});

export const DASH_PIE = [DASH_COLORS.accent, DASH_COLORS.accentSoft, DASH_COLORS.success, DASH_COLORS.warning];

export const DASH_CHART_TOOLTIP = {
  background: DASH_COLORS.surface,
  border: "1px solid rgba(56, 189, 248, 0.22)",
  borderRadius: 10,
  color: DASH_COLORS.text,
};

export const DASH_AXIS_TICK = { fill: DASH_COLORS.muted, fontSize: 10 };

export const DASH_ERROR_BORDER = "rgba(239, 68, 68, 0.5)";
export const DASH_WARNING_BORDER = "rgba(245, 158, 11, 0.55)";
export const DASH_WARNING_BG = "rgba(245, 158, 11, 0.08)";
export const DASH_SUCCESS_BORDER = "rgba(22, 163, 74, 0.45)";
export const DASH_SUCCESS_BG = "rgba(22, 163, 74, 0.08)";
