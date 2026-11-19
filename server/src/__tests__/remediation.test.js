import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { verifyFileContents } from '../utils/fileSignature.js'
import { generateOtp } from '../utils/mailer.js'

// Minimal, real magic-number-bearing byte sequences for each format we test.
const REAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)
const REAL_PDF = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF')
const FAKE_IMAGE_HTML = Buffer.from('<html><body><script>alert(document.cookie)</script></body></html>')
const FAKE_IMAGE_SVG = Buffer.from('<svg onload="alert(1)" xmlns="http://www.w3.org/2000/svg"></svg>')

describe('verifyFileContents (CWE-434 content-type confusion / stored-XSS fix)', () => {
  test('accepts a genuine PNG declared as image/png', async () => {
    const result = await verifyFileContents(REAL_PNG, 'image/png')
    assert.equal(result.ok, true)
  })

  test('accepts a genuine PDF declared as application/pdf', async () => {
    const result = await verifyFileContents(REAL_PDF, 'application/pdf')
    assert.equal(result.ok, true)
  })

  test('rejects HTML bytes disguised with an image/png declaration', async () => {
    // This is the exact attack the fix closes: presign with mimeType
    // image/png (passes the allowlist), then PUT real HTML bytes. Without
    // content sniffing, GET /api/uploads/file/:key would later serve this
    // back and a browser would render it — stored XSS.
    const result = await verifyFileContents(FAKE_IMAGE_HTML, 'image/png')
    assert.equal(result.ok, false)
  })

  test('rejects SVG bytes disguised with an image/jpeg declaration', async () => {
    const result = await verifyFileContents(FAKE_IMAGE_SVG, 'image/jpeg')
    assert.equal(result.ok, false)
  })

  test('rejects HTML bytes disguised as application/pdf', async () => {
    const result = await verifyFileContents(FAKE_IMAGE_HTML, 'application/pdf')
    assert.equal(result.ok, false)
  })

  test('accepts genuine plain text for a text/plain declaration', async () => {
    const result = await verifyFileContents(Buffer.from('Meeting notes: approved 5-0.'), 'text/plain')
    assert.equal(result.ok, true)
  })

  test('rejects markup smuggled under a text/plain declaration', async () => {
    const result = await verifyFileContents(FAKE_IMAGE_HTML, 'text/plain')
    assert.equal(result.ok, false)
  })
})

describe('generateOtp (CWE-338 weak RNG fix)', () => {
  test('produces a 6-digit numeric string in range every time', () => {
    for (let i = 0; i < 200; i++) {
      const otp = generateOtp()
      assert.match(otp, /^\d{6}$/)
      const n = Number(otp)
      assert.ok(n >= 100000 && n <= 999999)
    }
  })

  test('does not produce the same value on every call (sanity check against a stuck/broken generator)', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateOtp()))
    assert.ok(values.size > 1)
  })
})
