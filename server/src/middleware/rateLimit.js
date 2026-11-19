import rateLimit from 'express-rate-limit'

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in a few minutes.' }
})

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' }
})

// SECURITY (OWASP A07 - Identification & Authentication Failures): /refresh
// and /logout previously sat behind only the global apiLimiter (240/min).
// /refresh in particular takes a bare cookie and returns a fresh access
// token, so it's worth its own tighter ceiling — cheap insurance against
// cookie-guessing / credential-stuffing-style hammering of the endpoint,
// consistent with how /login is already limited. Kept looser than
// loginLimiter since legitimate clients call /refresh routinely (e.g. on
// every tab open / token expiry), not just once per human login attempt.
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again in a few minutes.' }
})
