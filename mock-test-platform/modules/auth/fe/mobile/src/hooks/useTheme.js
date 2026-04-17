import { useEffect, useState } from "react";
import { Appearance } from "react-native";
import { getThemeVars, DEFAULT_THEME, registerCustomTheme } from "../../../shared/themes.js";
import { Storage } from "../utils/storage.js";

export function useTheme(cfg) {
  const [mode, setMode] = useState("light");
  const [vars, setVars] = useState(getThemeVars(DEFAULT_THEME, "light"));

  useEffect(() => {
    (async () => {
      if (cfg?.custom_theme) registerCustomTheme(cfg.custom_theme);
      const control = cfg?.mode_control || "user";
      let m;
      if (control === "force_light") m = "light";
      else if (control === "force_dark") m = "dark";
      else if (control === "system") m = Appearance.getColorScheme() || "light";
      else m = (await Storage.get("theme_mode")) || "light";
      setMode(m);
      const themeName = cfg?.theme || cfg?.custom_theme?.name || DEFAULT_THEME;
      setVars(getThemeVars(themeName, m));
    })();
  }, [cfg]);

  const toggle = async () => {
    const next = mode === "light" ? "dark" : "light";
    await Storage.set("theme_mode", next);
    setMode(next);
    const themeName = cfg?.theme || cfg?.custom_theme?.name || DEFAULT_THEME;
    setVars(getThemeVars(themeName, next));
  };

  return { mode, vars, toggle };
}
