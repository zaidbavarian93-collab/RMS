import { createContext, useContext, useEffect, useState } from 'react';

// المظهر: auto (يتبع النظام كما في macOS) | light | dark
const ThemeContext = createContext(null);
const ORDER = ['auto', 'light', 'dark'];

function readPref() {
  try { const v = localStorage.getItem('theme'); return ORDER.includes(v) ? v : 'auto'; } catch { return 'auto'; }
}

export function ThemeProvider({ children }) {
  const [pref, setPref] = useState(readPref);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const theme = pref === 'auto' ? (systemDark ? 'dark' : 'light') : pref;
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#16121a' : '#f6efe9');
  }, [theme]);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setPref(next);
    try { localStorage.setItem('theme', next); } catch { /* التخزين غير متاح */ }
  }
  return <ThemeContext.Provider value={{ pref, theme, cycle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
