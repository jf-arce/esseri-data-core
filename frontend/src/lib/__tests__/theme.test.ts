import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, getThemePreference, saveThemePreference, THEME_STORAGE_KEY } from '@/lib/theme'

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('style')
})

describe('theme preferences', () => {
  it('uses light as the default when storage is empty or invalid', () => {
    expect(getThemePreference()).toBe('light')

    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia')

    expect(getThemePreference()).toBe('light')
  })

  it('persists a valid explicit preference', () => {
    saveThemePreference('dark')

    expect(getThemePreference()).toBe('dark')
  })

  it('applies the selected theme to the document', () => {
    applyTheme('dark')

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })
})
