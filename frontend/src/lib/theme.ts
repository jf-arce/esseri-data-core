export const THEME_STORAGE_KEY = 'esseri-theme'

export const themePreferences = ['light', 'dark'] as const

export type ThemePreference = (typeof themePreferences)[number]

function isThemePreference(value: string | null): value is ThemePreference {
  return value !== null && themePreferences.includes(value as ThemePreference)
}

export function getThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'light'

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(storedTheme) ? storedTheme : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(preference: ThemePreference) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.classList.toggle('dark', preference === 'dark')
  root.dataset.theme = preference
  root.style.colorScheme = preference
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // El tema sigue funcionando durante esta sesión aunque el navegador bloquee el storage.
  }
}
