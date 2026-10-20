export const COLOR_MODE_STORAGE_KEY = "tam-color-mode";

export const COLOR_MODES = {
  dark: {
    "--bg": "#09090b",
    "--bg-card": "#111113",
    "--bg-input": "#18181b",
    "--bg-hover": "#27272a",
    "--border": "#27272a",
    "--border-light": "#3f3f46",
    "--text": "#fafafa",
    "--text-dim": "#e4e4e7",
    "--text-muted": "#a1a1aa",
    "--accent": "#fafafa",
    "--accent-dark": "#e4e4e7",
    "--accent-soft": "rgba(250, 250, 250, 0.08)",
    "--accent-soft-strong": "rgba(250, 250, 250, 0.12)",
    "--accent-border": "rgba(250, 250, 250, 0.18)",
    "--accent-border-strong": "rgba(250, 250, 250, 0.28)",
    "--accent-solid": "rgba(250, 250, 250, 0.92)",
    "--success": "#4ade80",
    "--warning": "#fbbf24",
    "--danger": "#f87171",
    "--purple": "#a78bfa",
    "--foreground": "var(--text)",
    "--muted": "var(--text-muted)",
    "--card": "var(--bg-card)",
    "--card-muted": "var(--bg-input)",
    "--card-strong": "var(--bg-hover)",
    "--primary": "var(--accent)",
    "--primary-soft": "rgba(250, 250, 250, 0.10)",
    "--primary-foreground": "#09090b",
    "--ring": "var(--accent)",
    "--overlay": "rgba(0, 0, 0, 0.72)",
    "--warning-soft": "rgba(251, 191, 36, 0.14)",
    "--warning-strong": "var(--warning)",
    "--danger-strong": "var(--danger)",
    "--shadow-card": "0 18px 40px rgba(0, 0, 0, 0.24)",
    "--shadow-dialog": "0 24px 64px rgba(0, 0, 0, 0.55)",
    "--header-gradient": "linear-gradient(180deg, rgba(17, 17, 19, 0.98) 0%, rgba(9, 9, 11, 0.98) 100%)",
  },
  light: {
    "--bg": "#fafafa",
    "--bg-card": "#ffffff",
    "--bg-input": "#f4f4f5",
    "--bg-hover": "#ededf0",
    "--border": "#e4e4e7",
    "--border-light": "#d4d4d8",
    "--text": "#18181b",
    "--text-dim": "#27272a",
    "--text-muted": "#71717a",
    "--accent": "#18181b",
    "--accent-dark": "#09090b",
    "--accent-soft": "rgba(24, 24, 27, 0.08)",
    "--accent-soft-strong": "rgba(24, 24, 27, 0.12)",
    "--accent-border": "rgba(24, 24, 27, 0.16)",
    "--accent-border-strong": "rgba(24, 24, 27, 0.24)",
    "--accent-solid": "rgba(24, 24, 27, 0.88)",
    "--success": "#15803d",
    "--warning": "#b45309",
    "--danger": "#b91c1c",
    "--purple": "#7c3aed",
    "--foreground": "var(--text)",
    "--muted": "var(--text-muted)",
    "--card": "var(--bg-card)",
    "--card-muted": "var(--bg-input)",
    "--card-strong": "var(--bg-hover)",
    "--primary": "var(--accent)",
    "--primary-soft": "rgba(24, 24, 27, 0.10)",
    "--primary-foreground": "#fafafa",
    "--ring": "var(--accent)",
    "--overlay": "rgba(9, 9, 11, 0.72)",
    "--warning-soft": "rgba(180, 83, 9, 0.10)",
    "--warning-strong": "var(--warning)",
    "--danger-strong": "var(--danger)",
    "--shadow-card": "0 18px 40px rgba(24, 24, 27, 0.08)",
    "--shadow-dialog": "0 24px 64px rgba(24, 24, 27, 0.18)",
    "--header-gradient": "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 250, 250, 0.98) 100%)",
  },
};

export function getInitialColorMode() {
  if (typeof window === "undefined") return "dark";

  const saved = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
  if (saved === "dark" || saved === "light") return saved;

  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";

  return "light";
}

export function applyColorMode(
  colorMode,
  colorModeVars = COLOR_MODES[colorMode] || COLOR_MODES.dark,
) {
  if (typeof document === "undefined") return;

  const nextMode = colorMode === "light" ? "light" : "dark";
  const root = document.documentElement;
  const body = document.body;

  root.classList.toggle("dark", nextMode === "dark");
  root.style.colorScheme = nextMode;

  Object.entries(colorModeVars).forEach(([name, value]) => {
    root.style.setProperty(name, String(value));
  });

  if (body) {
    body.style.backgroundColor = colorModeVars["--bg"];
    body.style.color = colorModeVars["--text"];
  }
}
