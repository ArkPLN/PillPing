import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme as nwColorScheme, useColorScheme } from 'nativewind';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';

import { pick, type ColorToken } from './colors';

/**
 * 主题模式，对应 legacy Theme.SYSTEM / LIGHT / DARK。
 * 持久化 key 沿用 "theme_mode" 以保持语义一致。
 */
export const THEME_SYSTEM = 0;
export const THEME_LIGHT = 1;
export const THEME_DARK = 2;

export type ThemeMode = typeof THEME_SYSTEM | typeof THEME_LIGHT | typeof THEME_DARK;

const STORAGE_KEY = 'theme_mode';

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  /** 按当前亮暗取色，供无法用 className 的场景使用。 */
  color: (token: ColorToken) => string;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: THEME_SYSTEM,
  isDark: false,
  setMode: () => {},
  color: (token) => pick(token, false),
});

function applyNativeWindColorScheme(mode: ThemeMode) {
  // NativeWind v4: 用 'system' 表示跟随系统。
  nwColorScheme.set(mode === THEME_LIGHT ? 'light' : mode === THEME_DARK ? 'dark' : 'system');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(THEME_SYSTEM);
  const [ready, setReady] = useState(false);
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive) return;
        const parsed = raw === null ? THEME_SYSTEM : Number(raw);
        const next: ThemeMode =
          parsed === THEME_LIGHT || parsed === THEME_DARK ? (parsed as ThemeMode) : THEME_SYSTEM;
        setModeState(next);
        applyNativeWindColorScheme(next);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    applyNativeWindColorScheme(next);
    AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => {});
  }, []);

  // mode 显式指定时以 mode 为准；跟随系统时读 NativeWind 解析后的 colorScheme。
  const isDark = useMemo(() => {
    if (mode === THEME_DARK) return true;
    if (mode === THEME_LIGHT) return false;
    if (colorScheme === 'dark') return true;
    if (colorScheme === 'light') return false;
    return Appearance.getColorScheme() === 'dark';
  }, [mode, colorScheme]);

  const color = useCallback((token: ColorToken) => pick(token, isDark), [isDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, isDark, setMode, color }),
    [mode, isDark, setMode, color]
  );

  // 注意：不要在这里 return null。阻塞渲染会导致整页空白（web 尤其明显），
  // 且与 expo-splash-screen 的隐藏时机耦合。首帧颜色闪烁可接受。

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** 便捷 hook：只取"当前是否深色"。 */
export function useIsDark(): boolean {
  return useTheme().isDark;
}
