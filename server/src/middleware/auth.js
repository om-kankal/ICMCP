import { verifyAccessToken } from '../utils/jwt.js'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import User from '../models/User.js'

/**
 * Verifies the Bearer access token on the Authorization header and attaches
 * a lean `req.user` payload. Does NOT hit the DB on every request (the JWT
 * itself is the source of truth for role/name/email), keeping protected
 * routes fast; controllers that need the live document fetch it explicitly.
 */
export const verifyToken = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or malformed Authorization header')
  }

  let payload
  try {
    payload = verifyAccessToken(token)
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Access token expired')
    }
    throw ApiError.unauthorized('Invalid access token')
  }

  // Defensive check: make sure the user still exists / is active.
  const user = await User.findById(payload.sub)
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account no longer active')
  }

  req.user = {
    id: user._id.toString(),
    role: user.role,
    name: user.name,
    email: user.email
  }
  next()
})

/**
 * RBAC guard — use after verifyToken. Usage: requireRole('Admin') or
 * requireRole('Admin', 'Coordinator').
 */
export function requireRole(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized())
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`))
    }
    next()
  }
}
