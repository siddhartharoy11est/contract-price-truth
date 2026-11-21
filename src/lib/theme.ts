/** Light or dark theme, shared by the account menu and the guided tour. */
export const THEME_KEY = "cpt-theme";

export const isDark = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark");

export function setDark(next: boolean): boolean {
  document.documentElement.classList.toggle("dark", next);
  try {
    window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  } catch {
    // Theme still applies for this page load.
  }
  return next;
}

export const toggleTheme = () => setDark(!isDark());
