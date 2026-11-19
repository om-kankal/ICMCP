import { fileTypeFromBuffer } from 'file-type'

/**
 * SECURITY (CWE-434 / OWASP A03 — content-type confusion → stored XSS):
 * `POST /api/uploads/presign` only ever validated the *client-declared*
 * `mimeType` string against an allowlist — it never inspected the actual
 * bytes that later get PUT to `/api/uploads/mock/:key` and stored to disk.
 * Because the stored file keeps the caller-supplied file name (see
 * `sanitizeFileName` in uploadController.js), an attacker could declare
 * `fileType: 'Photo'` / `mimeType: 'image/png'` while naming the file
 * `evil.svg` or `evil.html` and uploading real HTML/SVG bytes. `GET
 * /api/uploads/file/:key` (`res.sendFile`) then serves that file back with
 * a `Content-Type` derived from the stored extension, so a browser
 * navigating to the "photo" URL — or an <img>/<iframe> pointed at it —
 * would render attacker-controlled HTML/SVG in the application's origin:
 * stored XSS.
 *
 * This module sniffs the *actual* magic bytes of the uploaded buffer and
 * confirms they're consistent with the fileType's declared mimeType before
 * the bytes are ever written to disk, closing that gap without changing
 * the public upload API/contract.
 */

// Magic-number-detectable formats we accept anywhere in the app, mapped to
// the sniffed mime(s) that are an acceptable match for each declared mime.
const DETECTABLE_MATCHES = {
  'image/jpeg': ['image/jpeg'],
  'image/png': ['image/png'],
  'image/gif': ['image/gif'],
  'application/pdf': ['application/pdf'],
  'application/zip': ['application/zip'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Some encoders produce a generic zip signature for docx; still a real
    // zip-based OOXML container, not a spoofed HTML/SVG payload.
    'application/zip'
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
}

// Legacy/OLE-based Office formats (old .doc / .xls) and plain text don't
// have a distinct, well-known "magic number" the `file-type` library can
// name precisely — `file-type` reports old Office binaries generically as
// `application/x-cfb` (Compound File Binary), and plain text has no magic
// number at all. We still guard these: CFB-expected formats must sniff as
// a genuine CFB container, and text/plain is checked with a lightweight
// heuristic instead of a signature.
const CFB_MIME = 'application/x-cfb'
const CFB_EXPECTED = new Set(['application/msword', 'application/vnd.ms-excel'])

const HTML_LIKE_PATTERN = /<\s*(script|html|svg|iframe|body|!doctype)\b/i

/**
 * Validates that `buffer` genuinely matches `declaredMimeType`.
 * Throws by returning `{ ok: false, reason }` — callers decide how to
 * surface that (kept as a plain return rather than throwing so this stays
 * a pure, easily-testable function).
 */
export async function verifyFileContents(buffer, declaredMimeType) {
  if (CFB_EXPECTED.has(declaredMimeType)) {
    const detected = await fileTypeFromBuffer(buffer)
    if (detected?.mime === CFB_MIME) return { ok: true }
    return {
      ok: false,
      reason: `File content does not match the declared type (${declaredMimeType})`
    }
  }

  if (declaredMimeType === 'text/plain') {
    // No magic number exists for plain text. Reject anything that looks
    // like it's actually markup — the specific case we care about
    // stopping (HTML/SVG smuggled in as a harmless-looking attachment).
    const head = buffer.subarray(0, 4096).toString('utf8')
    if (HTML_LIKE_PATTERN.test(head)) {
      return { ok: false, reason: 'File content looks like markup, not plain text' }
    }
    const detected = await fileTypeFromBuffer(buffer)
    if (detected) {
      // A real binary format sniffed under a text/plain declaration —
      // also reject, since it's not actually plain text either.
      return { ok: false, reason: 'File content does not match the declared type (text/plain)' }
    }
    return { ok: true }
  }

  const acceptableDetections = DETECTABLE_MATCHES[declaredMimeType]
  if (!acceptableDetections) {
    // Declared mime isn't one we know how to sniff — shouldn't happen given
    // the fixed ACCEPTED_MIME allowlist upstream, but fail closed.
    return { ok: false, reason: `Unrecognized file type for content verification: ${declaredMimeType}` }
  }

  const detected = await fileTypeFromBuffer(buffer)
  if (!detected || !acceptableDetections.includes(detected.mime)) {
    return {
      ok: false,
      reason: `File content does not match the declared type (${declaredMimeType})`
    }
  }
  return { ok: true }
}
