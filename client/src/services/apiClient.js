import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// The access token lives in memory only (not localStorage) to reduce XSS
// exposure. It's re-obtained on page load via the httpOnly refresh cookie
// (see AuthContext's bootstrap effect), so a hard refresh doesn't log the
// user out.
let accessToken = null
let onUnauthorized = () => {}

export function setAccessToken(token) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true // send the httpOnly refresh cookie on every request
})

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// Silent-refresh queue: if several requests 401 at once (e.g. a dashboard
// firing multiple fetches in parallel right as the access token expires),
// only the first triggers a refresh call; the rest wait on the same promise.
let refreshPromise = null

async function performRefresh() {
  // A plain axios call (not apiClient) to avoid recursively hitting this
  // same response interceptor.
  const res = await axios.post(
    `${API_URL}/auth/refresh`,
    {},
    { withCredentials: true }
  )
  const { accessToken: newToken } = res.data.data
  setAccessToken(newToken)
  return newToken
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error
    const isAuthRoute = config?.url?.includes('/auth/login') || config?.url?.includes('/auth/refresh')

    if (response?.status === 401 && !config._retry && !isAuthRoute) {
      config._retry = true
      try {
        refreshPromise = refreshPromise || performRefresh()
        const newToken = await refreshPromise
        refreshPromise = null
        config.headers.Authorization = `Bearer ${newToken}`
        return apiClient(config)
      } catch (refreshError) {
        refreshPromise = null
        setAccessToken(null)
        onUnauthorized()
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

/** Normalizes an Axios error into a plain, displayable message + details. */
export function extractErrorMessage(err) {
  if (err.response?.data?.message) {
    const base = err.response.data.message
    const details = err.response.data.details
    if (Array.isArray(details) && details.length) {
      return `${base}: ${details.map((d) => d.message).join('; ')}`
    }
    return base
  }
  if (err.request) return 'Could not reach the server. Please check your connection.'
  return err.message || 'Something went wrong.'
}
