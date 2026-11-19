import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { updatePreferences } from '../services/profileService'

const ThemeContext = createContext(null)

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function applyThemeClass(resolvedDark) {
  document.documentElement.classList.toggle('dark', resolvedDark)
}

export function ThemeProvider({ children }) {
  const { user, updateLocalUser } = useAuth()
  // Before login there's no saved preference to read, so default to the
  // OS-level preference; once a user is known, their saved choice takes over.
  const [theme, setThemeState] = useState(() => user?.preferences?.theme || 'system')

  const resolvedDark = theme === 'dark' || (theme === 'system' && systemPrefersDark())

  useEffect(() => {
    applyThemeClass(resolvedDark)
  }, [resolvedDark])

  // Keep in sync if the user logs in/out or their profile reloads elsewhere.
  useEffect(() => {
    if (user?.preferences?.theme) setThemeState(user.preferences.theme)
  }, [user?.preferences?.theme])

  // Live-update when in "system" mode and the OS theme changes.
  useEffect(() => {
    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyThemeClass(systemPrefersDark())
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback(
    async (nextTheme) => {
      setThemeState(nextTheme) // apply immediately, don't wait on the network
      applyThemeClass(nextTheme === 'dark' || (nextTheme === 'system' && systemPrefersDark()))
      if (!user) return // not logged in yet (e.g. previewing on the login screen) — nothing to persist
      try {
        const updated = await updatePreferences({ theme: nextTheme })
        updateLocalUser(updated)
      } catch {
        // Non-critical — the visual change already applied; persistence can
        // be retried next time they change it, and it'll resync on next login.
      }
    },
    [user, updateLocalUser]
  )

  return <ThemeContext.Provider value={{ theme, resolvedDark, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
