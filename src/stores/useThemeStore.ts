import { create } from 'zustand'

interface ThemeState {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('elcasa_pos_theme') as 'light' | 'dark') || 'dark',
  setTheme: (theme) => {
    localStorage.setItem('elcasa_pos_theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    set({ theme })
  },
}))
