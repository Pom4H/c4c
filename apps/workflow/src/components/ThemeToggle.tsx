"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    
    // Get initial theme from localStorage or system preference
    const savedTheme = localStorage.getItem("theme") as Theme;
    if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) {
      setTheme(savedTheme);
    }
  }, []);

  // Apply theme changes
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove("light", "dark");
    
    let effectiveTheme: "light" | "dark";
    
    if (theme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      effectiveTheme = theme;
    }
    
    // Apply the effective theme
    root.classList.add(effectiveTheme);
    
    // Save to localStorage
    localStorage.setItem("theme", theme);
  }, [theme, mounted]);

  // Listen for system theme changes when using system theme
  useEffect(() => {
    if (!mounted || theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = () => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(mediaQuery.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, mounted]);

  if (!mounted) {
    // Return a placeholder with the same dimensions to prevent layout shift
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
        <div className="w-20 h-4 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const getThemeIcon = (currentTheme: Theme) => {
    switch (currentTheme) {
      case "light":
        return <Sun className="h-5 w-5" />;
      case "dark":
        return <Moon className="h-5 w-5" />;
      case "system":
        return <Monitor className="h-5 w-5" />;
    }
  };

  const cycleTheme = () => {
    setTheme((prev) => {
      switch (prev) {
        case "light":
          return "dark";
        case "dark":
          return "system";
        case "system":
          return "light";
        default:
          return "system";
      }
    });
  };

  return (
    <Button
      variant="secondary"
      size="default"
      onClick={cycleTheme}
      className="gap-2"
      title={`Current theme: ${theme}. Click to cycle through themes.`}
    >
      {getThemeIcon(theme)}
      <span className="text-sm font-medium capitalize">
        {theme}
      </span>
    </Button>
  );
}
