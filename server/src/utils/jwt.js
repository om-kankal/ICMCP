import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, name: user.name, email: user.email },
    env.accessTokenSecret,
    { expiresIn: env.accessTokenTtl }
  )
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user._id.toString(), tokenType: 'refresh' }, env.refreshTokenSecret, {
    expiresIn: env.refreshTokenTtl
  })
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.accessTokenSecret)
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.refreshTokenSecret)
}

export const REFRESH_COOKIE_NAME = 'icmcp_refresh_token'

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    maxAge: env.refreshTokenTtlMs,
    path: '/api/auth'
  }
}
