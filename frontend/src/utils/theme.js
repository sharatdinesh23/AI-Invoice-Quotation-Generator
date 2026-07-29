// frontend/src/utils/theme.js

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
}

// Get the user's saved theme preference
export const getStoredTheme = () => {
  return localStorage.getItem('theme') || THEMES.SYSTEM
}

// Save theme preference
export const setStoredTheme = (theme) => {
  localStorage.setItem('theme', theme)
}

// Determine if dark mode should be applied based on preference
const shouldApplyDark = (theme) => {
  if (theme === THEMES.DARK) return true
  if (theme === THEMES.LIGHT) return false
  // System preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Apply the theme to the document
export const applyTheme = (theme) => {
  const root = document.documentElement
  
  if (shouldApplyDark(theme)) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

// Initialize theme on app load
export const initTheme = () => {
  const theme = getStoredTheme()
  applyTheme(theme)
  
  // Listen for system theme changes if user selected "system"
  if (theme === THEMES.SYSTEM) {
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        const currentTheme = getStoredTheme()
        if (currentTheme === THEMES.SYSTEM) {
          applyTheme(THEMES.SYSTEM)
        }
      })
  }
}