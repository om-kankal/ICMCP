import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getSettings } from '../services/settingsService'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({ collegeName: '', collegeTagline: '', collegeLogoUrl: null })
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await getSettings()
      setSettings(data)
    } catch {
      // Non-critical — the header/letterhead just falls back to text-only.
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return <SettingsContext.Provider value={{ settings, loaded, refresh }}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}
