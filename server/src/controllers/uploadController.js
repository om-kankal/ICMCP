import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import UploadTicket from '../models/UploadTicket.js'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { env } from '../config/env.js'
import { verifyFileContents } from '../utils/fileSignature.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', env.uploadDir)

if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true })
}

const ACCEPTED_MIME = {
  Agenda: ['application/pdf'],
  MoM: ['application/pdf'],
  Photo: ['image/jpeg', 'image/png'],
  Avatar: ['image/jpeg', 'image/png'],
  Logo: ['image/jpeg', 'image/png'],
  NoticeAttachment: ['application/pdf', 'image/jpeg', 'image/png'],
  NewsPhoto: ['image/jpeg', 'image/png'],
  WorkProof: ['image/jpeg', 'image/png'],
  MailAttachment: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
}

/**
 * POST /api/uploads/presign
 *
 * Mimics an S3 `createPresignedPost` / `PutObject` presign call: the client
 * declares what it wants to upload (fileType/name/mime), the server issues a
 * short-lived, single-use ticket scoped to exactly that object, and returns
 * a URL the client can PUT the raw bytes to directly — without those bytes
 * ever passing through the JSON metadata endpoints. Swapping this
 * implementation for real `@aws-sdk/s3-request-presigner` calls would not
 * require any change on the frontend, since it only consumes
 * { uploadUrl, storageKey }.
 */
export const createPresignedUpload = asyncHandler(async (req, res) => {
  const { fileType, fileName, mimeType } = req.body

  if (!ACCEPTED_MIME[fileType]) {
    throw ApiError.badRequest(`Unsupported fileType: ${fileType}`)
  }
  if (!ACCEPTED_MIME[fileType].includes(mimeType)) {
    throw ApiError.badRequest(
      `${fileType} must be one of: ${ACCEPTED_MIME[fileType].join(', ')} (got ${mimeType})`
    )
  }

  const storageKey = `${fileType.toLowerCase()}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(fileName)}`
  const expiresAt = new Date(Date.now() + env.presignTtlMs)

  await UploadTicket.create({
    storageKey,
    fileType,
    originalName: fileName,
    mimeType,
    requestedBy: req.user.id,
    expiresAt
  })

  res.status(201).json({
    success: true,
    data: {
      // The frontend PUTs the raw file to this URL.
      uploadUrl: `/api/uploads/mock/${encodeURIComponent(storageKey)}`,
      storageKey,
      expiresAt,
      // What the document record will resolve to once the upload lands —
      // analogous to the eventual https://bucket.s3.amazonaws.com/key URL.
      cloudUrl: `/api/uploads/file/${encodeURIComponent(storageKey)}`
    }
  })
})

/**
 * PUT /api/uploads/mock/:key
 *
 * Stands in for the S3 bucket itself. Accepts the raw binary body for a
 * previously presigned key (buffered into req.body by the express.raw()
 * middleware on this route), validates the ticket hasn't expired or already
 * been consumed, then writes it to local disk. Marks the ticket consumed so
 * it can't be reused.
 */
export const receiveMockUpload = asyncHandler(async (req, res) => {
  const storageKey = decodeURIComponent(req.params.key)
  const ticket = await UploadTicket.findOne({ storageKey })

  if (!ticket) throw ApiError.notFound('No such presigned upload ticket')
  if (ticket.consumed) throw ApiError.conflict('This upload URL has already been used')
  if (ticket.expiresAt.getTime() < Date.now()) throw ApiError.gone('This upload URL has expired')

  // express.raw() on this route already buffered the full request body —
  // req.body is a Buffer here, not a stream to be read manually.
  const fileBuffer = req.body
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw ApiError.badRequest('No file data received')
  }

  const MAX_BYTES = 15 * 1024 * 1024 // 15 MB ceiling for the prototype
  if (fileBuffer.length > MAX_BYTES) {
    throw ApiError.badRequest('File exceeds 15 MB limit')
  }

  // SECURITY (CWE-434 — content-type confusion / stored XSS): confirm the
  // bytes actually PUT to this URL match the mimeType that was declared
  // (and allowlist-checked) back at presign time. Without this, a caller
  // could declare `image/png` to pass the allowlist and then upload real
  // HTML/SVG bytes, which `GET /api/uploads/file/:key` would later serve
  // back and a browser would render as markup. See utils/fileSignature.js.
  const verification = await verifyFileContents(fileBuffer, ticket.mimeType)
  if (!verification.ok) {
    throw ApiError.badRequest(verification.reason)
  }

  const destPath = resolveSafeUploadPath(storageKey)
  fs.mkdirSync(path.dirname(destPath), { recursive: true })
  fs.writeFileSync(destPath, fileBuffer)

  ticket.consumed = true
  ticket.consumedAt = new Date()
  await ticket.save()

  res.status(200).json({
    success: true,
    data: {
      storageKey,
      sizeBytes: fileBuffer.length,
      cloudUrl: `/api/uploads/file/${encodeURIComponent(storageKey)}`
    }
  })
})

/**
 * GET /api/uploads/file/:key — serves the stored binary back out (stand-in
 * for a public/signed-GET S3 object URL), used for photo/document previews.
 */
export const serveUploadedFile = asyncHandler(async (req, res) => {
  const storageKey = decodeURIComponent(req.params.key)
  const filePath = resolveSafeUploadPath(storageKey)

  if (!fs.existsSync(filePath)) {
    throw ApiError.notFound('File not found')
  }
  res.sendFile(filePath)
})

function sanitizeFileName(name = 'file') {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
}

/**
 * SECURITY (CWE-22 / OWASP A01 — Path Traversal): resolves `storageKey`
 * against UPLOAD_ROOT and throws unless the result is strictly *inside*
 * UPLOAD_ROOT. A naive `resolved.startsWith(UPLOAD_ROOT)` check (the
 * previous implementation) is bypassable: if UPLOAD_ROOT is
 * "/app/uploads", a storageKey of "../uploads-evil/x" resolves to
 * "/app/uploads-evil/x" — which *does* start with the string "/app/uploads"
 * even though it's a completely different, sibling directory. Comparing
 * against `UPLOAD_ROOT + path.sep` closes that gap by requiring an actual
 * path-separator boundary, not just a matching string prefix.
 */
export function resolveSafeUploadPath(storageKey) {
  const resolved = path.resolve(UPLOAD_ROOT, storageKey)
  const rootWithSep = UPLOAD_ROOT.endsWith(path.sep) ? UPLOAD_ROOT : UPLOAD_ROOT + path.sep
  if (resolved !== UPLOAD_ROOT && !resolved.startsWith(rootWithSep)) {
    throw ApiError.badRequest('Invalid file path')
  }
  return resolved
}
