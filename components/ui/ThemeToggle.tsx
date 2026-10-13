"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { currentTheme, setTheme, subscribeTheme } from "@/lib/client/theme";

/** Light by default; one tap for dark. The icon shows the theme you'd switch to. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "light" as const);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      aria-label="Dark mode"
      aria-pressed={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink ${className}`}
    >
      {dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}
