const STORAGE_KEY = "admin_theme";

export const THEME_OPTIONS = [
  { id: "default", label: "Default" },
  { id: "dark", label: "Dark" },
  { id: "grayscale", label: "Grayscale" },
];

export function getTheme() {
  const t = localStorage.getItem(STORAGE_KEY);
  return THEME_OPTIONS.some((o) => o.id === t) ? t : "default";
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
}