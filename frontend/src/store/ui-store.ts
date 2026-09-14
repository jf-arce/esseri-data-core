import { create } from 'zustand'
import {
  applyTheme,
  getThemePreference,
  saveThemePreference,
  type ThemePreference,
} from '@/lib/theme'

interface UiState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  themePreference: ThemePreference
  setThemePreference: (preference: ThemePreference) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  themePreference: getThemePreference(),
  setThemePreference: (preference) => {
    saveThemePreference(preference)
    applyTheme(preference)
    set({ themePreference: preference })
  },
}))
