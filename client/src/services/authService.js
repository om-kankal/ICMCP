import { apiClient, setAccessToken } from './apiClient'

export async function login(email, password) {
  const res = await apiClient.post('/auth/login', { email, password })
  const { accessToken, user } = res.data.data
  setAccessToken(accessToken)
  return user
}

export async function logout() {
  try {
    await apiClient.post('/auth/logout')
  } finally {
    setAccessToken(null)
  }
}

/** Attempts to silently resume a session using the httpOnly refresh cookie. */
export async function resumeSession() {
  const res = await apiClient.post('/auth/refresh')
  const { accessToken, user } = res.data.data
  setAccessToken(accessToken)
  return user
}

export async function fetchMe() {
  const res = await apiClient.get('/auth/me')
  return res.data.data
}
