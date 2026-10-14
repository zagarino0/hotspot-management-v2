import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePreference = "light" | "monokai-dimmed";
const ThemeContext = createContext<{ theme: ThemePreference; setTheme: (theme: ThemePreference) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    try {
      return localStorage.getItem("hotspot-management-theme") === "monokai-dimmed" ? "monokai-dimmed" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "monokai-dimmed");
    document.documentElement.style.colorScheme = theme === "monokai-dimmed" ? "dark" : "light";
    try { localStorage.setItem("hotspot-management-theme", theme); } catch { /* storage may be disabled */ }
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme doit être utilisé dans ThemeProvider.");
  return context;
}
