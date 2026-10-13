/**
 * Light is the default (brightwheel's own look); dark is an opt-in saved per
 * browser. The inline script applies a saved choice before first paint, so a
 * dark-mode visitor never sees a light flash.
 */
export type Theme = "light" | "dark";

export const THEME_KEY = "fd:theme";
export const THEME_COLOR: Record<Theme, string> = { light: "#f7f9ff", dark: "#0f1120" };

export const themeInitScript = `try{if(localStorage.getItem(${JSON.stringify(THEME_KEY)})==="dark"){document.documentElement.dataset.theme="dark";var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=${JSON.stringify(THEME_COLOR.dark)}}}catch(e){}`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.dataset.theme = "dark";
  else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  try {
    if (theme === "dark") localStorage.setItem(THEME_KEY, "dark");
    else localStorage.removeItem(THEME_KEY);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

export function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
