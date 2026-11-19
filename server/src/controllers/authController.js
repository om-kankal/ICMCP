import User from '../models/User.js'
import UploadTicket from '../models/UploadTicket.js'
import PendingVerification from '../models/PendingVerification.js'
import PasswordResetToken from '../models/PasswordResetToken.js'
import bcrypt from 'bcryptjs'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendOtpEmail, generateOtp, hashResetToken } from '../utils/mailer.js'
import { env } from '../config/env.js'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions
} from '../utils/jwt.js'

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash')
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid email or password')
  }

  const matches = await user.comparePassword(password)
  if (!matches) {
    throw ApiError.unauthorized('Invalid email or password')
  }

  const accessToken = signAccessToken(user)
  const refreshToken = signRefreshToken(user)

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions())
  res.status(200).json({
    success: true,
    data: { accessToken, user: user.toSafeJSON() }
  })
})

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME]
  if (!token) {
    throw ApiError.unauthorized('No refresh token supplied')
  }

  let payload
  try {
    payload = verifyRefreshToken(token)
  } catch {
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions())
    throw ApiError.unauthorized('Refresh token invalid or expired — please sign in again')
  }

  const user = await User.findById(payload.sub)
  if (!user || !user.isActive) {
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions())
    throw ApiError.unauthorized('Account no longer active')
  }

  // Rotate the refresh token on every use to limit replay-attack windows.
  const accessToken = signAccessToken(user)
  const newRefreshToken = signRefreshToken(user)
  res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, refreshCookieOptions())

  res.status(200).json({
    success: true,
    data: { accessToken, user: user.toSafeJSON() }
  })
})

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions())
  res.status(200).json({ success: true, message: 'Signed out' })
})

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
  if (!user) throw ApiError.notFound('User not found')
  res.status(200).json({ success: true, data: user.toSafeJSON() })
})

/**
 * PATCH /api/auth/profile — update name or designation only. Email changes
 * now require OTP verification — see requestEmailChangeOtp / confirmEmailChangeOtp.
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, designation } = req.body
  const user = await User.findById(req.user.id)
  if (!user) throw ApiError.notFound('User not found')

  if (name !== undefined) user.name = name
  if (designation !== undefined) user.designation = designation

  await user.save({ validateModifiedOnly: true })
  res.status(200).json({ success: true, data: user.toSafeJSON() })
})

/**
 * POST /api/auth/email/request-otp
 * Verifies the current password, checks the new email is free, then emails
 * a 6-digit OTP to the NEW address (proving the user actually owns it).
 * Nothing changes on the account until the OTP is confirmed.
 */
export const requestEmailChangeOtp = asyncHandler(async (req, res) => {
  const { newEmail, currentPassword } = req.body
  const user = await User.findById(req.user.id).select('+passwordHash')
  if (!user) throw ApiError.notFound('User not found')

  const matches = await user.comparePassword(currentPassword)
  if (!matches) throw ApiError.unauthorized('Current password is incorrect')

  const normalizedEmail = newEmail.toLowerCase().trim()
  if (normalizedEmail === user.email) {
    throw ApiError.badRequest('That is already your current email address')
  }
  const existing = await User.findOne({ email: normalizedEmail })
  if (existing) throw ApiError.conflict('That email is already in use')

  // Clear out any earlier pending request for this user/purpose before issuing a new one.
  await PendingVerification.deleteMany({ userRef: user._id, purpose: 'email_change' })

  const otp = generateOtp()
  const otpHash = await bcrypt.hash(otp, 10)
  await PendingVerification.create({
    userRef: user._id,
    purpose: 'email_change',
    otpHash,
    newEmail: normalizedEmail,
    expiresAt: new Date(Date.now() + env.otpTtlMs)
  })

  await sendOtpEmail(normalizedEmail, otp, 'email_change')

  res.status(200).json({
    success: true,
    message: `A verification code has been sent to ${normalizedEmail}`
  })
})

/** POST /api/auth/email/verify-otp — applies the pending email change if the OTP matches. */
export const confirmEmailChangeOtp = asyncHandler(async (req, res) => {
  const { otp } = req.body
  const pending = await PendingVerification.findOne({
    userRef: req.user.id,
    purpose: 'email_change',
    consumed: false
  })
    .select('+otpHash')
    .sort({ createdAt: -1 })
  if (!pending) throw ApiError.badRequest('No pending email change request — start over')

  if (pending.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest('This code has expired — request a new one')
  }
  if (pending.attempts >= 5) {
    throw ApiError.badRequest('Too many incorrect attempts — request a new code')
  }

  const matches = await bcrypt.compare(otp, pending.otpHash)
  if (!matches) {
    pending.attempts += 1
    await pending.save()
    throw ApiError.unauthorized('Incorrect code')
  }

  const existing = await User.findOne({ email: pending.newEmail })
  if (existing) throw ApiError.conflict('That email is already in use')

  const user = await User.findById(req.user.id)
  if (!user) throw ApiError.notFound('User not found')
  user.email = pending.newEmail
  await user.save({ validateModifiedOnly: true })

  pending.consumed = true
  await pending.save()

  res.status(200).json({ success: true, data: user.toSafeJSON(), message: 'Email address updated' })
})

/**
 * POST /api/auth/password/request-otp
 * Verifies the current password and new-password strength, then emails a
 * 6-digit OTP to the account's current email. Nothing changes until it's confirmed.
 */
export const requestPasswordChangeOtp = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  const user = await User.findById(req.user.id).select('+passwordHash')
  if (!user) throw ApiError.notFound('User not found')

  const matches = await user.comparePassword(currentPassword)
  if (!matches) throw ApiError.unauthorized('Current password is incorrect')

  await PendingVerification.deleteMany({ userRef: user._id, purpose: 'password_change' })

  const otp = generateOtp()
  const otpHash = await bcrypt.hash(otp, 10)
  const newPasswordHash = await bcrypt.hash(newPassword, 12)
  await PendingVerification.create({
    userRef: user._id,
    purpose: 'password_change',
    otpHash,
    newPasswordHash,
    expiresAt: new Date(Date.now() + env.otpTtlMs)
  })

  await sendOtpEmail(user.email, otp, 'password_change')

  res.status(200).json({
    success: true,
    message: `A verification code has been sent to ${user.email}`
  })
})

/** POST /api/auth/password/verify-otp — applies the pending password change if the OTP matches. */
export const confirmPasswordChangeOtp = asyncHandler(async (req, res) => {
  const { otp } = req.body
  const pending = await PendingVerification.findOne({
    userRef: req.user.id,
    purpose: 'password_change',
    consumed: false
  })
    .select('+otpHash +newPasswordHash')
    .sort({ createdAt: -1 })
  if (!pending) throw ApiError.badRequest('No pending password change request — start over')

  if (pending.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest('This code has expired — request a new one')
  }
  if (pending.attempts >= 5) {
    throw ApiError.badRequest('Too many incorrect attempts — request a new code')
  }

  const matches = await bcrypt.compare(otp, pending.otpHash)
  if (!matches) {
    pending.attempts += 1
    await pending.save()
    throw ApiError.unauthorized('Incorrect code')
  }

  const user = await User.findById(req.user.id)
  if (!user) throw ApiError.notFound('User not found')
  user.passwordHash = pending.newPasswordHash
  await user.save({ validateModifiedOnly: true })

  pending.consumed = true
  await pending.save()

  res.status(200).json({ success: true, message: 'Password updated' })
})

/** PATCH /api/auth/preferences — currently just theme, structured to grow. */
export const updatePreferences = asyncHandler(async (req, res) => {
  const { theme } = req.body
  const user = await User.findById(req.user.id)
  if (!user) throw ApiError.notFound('User not found')

  if (theme) user.preferences.theme = theme
  await user.save({ validateModifiedOnly: true })
  res.status(200).json({ success: true, data: user.toSafeJSON() })
})

/**
 * GET /api/auth/reset-password/:token — public. Lets the reset-password
 * page confirm the link is still valid (and show whose account it's for)
 * before the person bothers typing a new password. Never reveals *why* an
 * invalid token is invalid (expired vs. already used vs. never existed) —
 * just "valid" or not, same principle as not distinguishing "wrong
 * password" from "no such account" on login.
 */
export const checkResetToken = asyncHandler(async (req, res) => {
  const tokenHash = hashResetToken(req.params.token || '')
  const pending = await PasswordResetToken.findOne({ tokenHash, consumed: false }).populate('userRef', 'name email')
  if (!pending || pending.expiresAt.getTime() < Date.now() || !pending.userRef) {
    return res.status(200).json({ success: true, data: { valid: false } })
  }
  res.status(200).json({
    success: true,
    data: { valid: true, name: pending.userRef.name, email: pending.userRef.email }
  })
})

/**
 * POST /api/auth/reset-password — public. Consumes a single-use
 * password-reset link token (emailed via sendWelcomeAccountEmail /
 * sendPasswordResetLinkEmail — see bulkImportController.js and
 * userController.js) and sets the new password.
 */
export const applyResetToken = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body
  const tokenHash = hashResetToken(token || '')
  const pending = await PasswordResetToken.findOne({ tokenHash, consumed: false })
  if (!pending || pending.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest('This link is invalid or has expired — ask an administrator to send a new one')
  }

  const user = await User.findById(pending.userRef)
  if (!user || !user.isActive) throw ApiError.badRequest('This account is no longer active')

  user.password = newPassword // virtual → re-hashed by the pre-validate hook
  await user.save({ validateModifiedOnly: true })

  pending.consumed = true
  await pending.save()

  // Any other still-pending links for this same user are now stale — a
  // forwarded/old link shouldn't be able to reset the password again.
  await PasswordResetToken.updateMany(
    { userRef: user._id, consumed: false },
    { $set: { consumed: true } }
  )

  res.status(200).json({ success: true, message: 'Password set — you can now sign in.' })
})

/**
 * PATCH /api/auth/avatar — links a photo already uploaded via the
 * presigned-URL flow (POST /api/uploads/presign with fileType: 'Avatar').
 * Verifying the ticket was actually consumed prevents someone from setting
 * an arbitrary avatarUrl without genuinely uploading anything.
 */
export const confirmAvatar = asyncHandler(async (req, res) => {
  const { storageKey } = req.body
  const ticket = await UploadTicket.findOne({ storageKey, fileType: 'Avatar' })
  if (!ticket || !ticket.consumed) {
    throw ApiError.badRequest('This file was never uploaded via a valid presigned URL')
  }
  // SECURITY (CWE-639 — IDOR/BOLA): the storageKey contains a
  // crypto.randomUUID() component and isn't practically guessable, but it
  // could still leak (server logs, referrer headers, a shared screenshot).
  // Require the ticket to belong to the caller so a leaked/observed key
  // from someone else's upload can't be claimed as your own avatar.
  if (ticket.requestedBy.toString() !== req.user.id) {
    throw ApiError.forbidden('This upload does not belong to you')
  }

  const user = await User.findById(req.user.id)
  if (!user) throw ApiError.notFound('User not found')

  user.avatarUrl = `/api/uploads/file/${encodeURIComponent(storageKey)}`
  await user.save({ validateModifiedOnly: true })
  res.status(200).json({ success: true, data: user.toSafeJSON() })
})
