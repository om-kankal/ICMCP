import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { login as loginRequest, logout as logoutRequest, resumeSession } from '../services/authService'
import { setUnauthorizedHandler } from '../services/apiClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [authError, setAuthError] = useState(null)

  // On first load, try to resume a session from the httpOnly refresh
  // cookie — this is what lets a page refresh keep the user signed in even
  // though the access token itself only lives in memory.
  useEffect(() => {
    let cancelled = false
    resumeSession()
      .then((resumedUser) => {
        if (!cancelled) setUser(resumedUser)
      })
      .catch(() => {
        // No valid session — this is the normal "logged out" state, not an error.
      })
      .finally(() => {
        if (!cancelled) setBootstrapping(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
  }, [])

  const login = useCallback(async (email, password) => {
    setAuthError(null)
    try {
      const loggedInUser = await loginRequest(email, password)
      setUser(loggedInUser)
      return loggedInUser
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to sign in. Please try again.'
      setAuthError(message)
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest()
    setUser(null)
  }, [])

  // Called after profile/password/preferences/avatar updates so the cached
  // user object reflects the change immediately, without a full re-login.
  const updateLocalUser = useCallback((updatedFields) => {
    setUser((prev) => (prev ? { ...prev, ...updatedFields } : prev))
  }, [])

  return (
    <AuthContext.Provider value={{ user, bootstrapping, authError, login, logout, updateLocalUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
