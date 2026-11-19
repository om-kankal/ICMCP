import Settings from '../models/Settings.js'
import UploadTicket from '../models/UploadTicket.js'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { env } from '../config/env.js'

function toPublicShape(settings) {
  return {
    collegeName: settings.collegeName || env.institutionName,
    collegeTagline: env.institutionTagline,
    collegeLogoUrl: settings.collegeLogoUrl,
    tosUrl: settings.tosUrl || null,
    privacyUrl: settings.privacyUrl || null
  }
}

/** GET /api/settings — every authenticated user needs this for the header/letterhead. */
export const getSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton()
  res.status(200).json({ success: true, data: toPublicShape(settings) })
})

/**
 * PATCH /api/settings — Admin only. Updates the institution name (supports
 * multiple lines), Terms of Service URL, and Privacy Policy URL. Logo
 * changes go through PATCH /api/settings/logo below.
 */
export const updateInstitutionalSettings = asyncHandler(async (req, res) => {
  const { collegeName, tosUrl, privacyUrl } = req.body

  const settings = await Settings.getSingleton()
  if (collegeName !== undefined) settings.collegeName = collegeName.trim() || null
  if (tosUrl !== undefined) settings.tosUrl = tosUrl.trim() || null
  if (privacyUrl !== undefined) settings.privacyUrl = privacyUrl.trim() || null
  settings.updatedBy = req.user.id
  await settings.save()

  res.status(200).json({ success: true, data: toPublicShape(settings) })
})

/**
 * PATCH /api/settings/logo — Admin only. Links a logo image already
 * uploaded via the presigned-URL flow (POST /api/uploads/presign with
 * fileType: 'Logo'), same pattern as confirmAvatar.
 */
export const updateCollegeLogo = asyncHandler(async (req, res) => {
  const { storageKey } = req.body
  const ticket = await UploadTicket.findOne({ storageKey, fileType: 'Logo' })
  if (!ticket || !ticket.consumed) {
    throw ApiError.badRequest('This file was never uploaded via a valid presigned URL')
  }

  const settings = await Settings.getSingleton()
  settings.collegeLogoUrl = `/api/uploads/file/${encodeURIComponent(storageKey)}`
  settings.collegeLogoStorageKey = storageKey
  settings.updatedBy = req.user.id
  await settings.save()

  res.status(200).json({ success: true, data: toPublicShape(settings) })
})
