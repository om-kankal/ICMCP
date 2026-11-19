import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import path from 'path'
import { resolveSafeUploadPath } from '../controllers/uploadController.js'

// Matches the same pattern enforced server-side in routes/userRoutes.js.
const NAME_PATTERN = /^[A-Za-z ]+$/

describe('resolveSafeUploadPath (CWE-22 path traversal fix)', () => {
  test('rejects classic ../ traversal out of UPLOAD_ROOT', () => {
    assert.throws(() => resolveSafeUploadPath('../../../../etc/passwd'))
  })

  test('rejects the sibling-directory startsWith() bypass', () => {
    // The bug this fix closes: a naive `resolved.startsWith(UPLOAD_ROOT)`
    // check treats "<root>-evil" as being inside "<root>" because the
    // *string* "<root>-evil" starts with the substring "<root>" — even
    // though it's a completely different, sibling directory.
    const siblingEscape = '../' + path.basename(process.cwd()) + '-evil/x'
    assert.throws(() => resolveSafeUploadPath(siblingEscape))
  })

  test('rejects an absolute path override', () => {
    assert.throws(() => resolveSafeUploadPath('/etc/passwd'))
  })

  test('allows a normal, well-formed storage key', () => {
    assert.doesNotThrow(() => resolveSafeUploadPath('avatar/1234-uuid-photo.png'))
  })
})

describe('User name validation (letters + spaces only)', () => {
  test('accepts a plain name', () => {
    assert.equal(NAME_PATTERN.test('Jane Doe'), true)
  })

  test('rejects digits', () => {
    assert.equal(NAME_PATTERN.test('Jane123'), false)
  })

  test('rejects NoSQL-injection-shaped input smuggled as a string', () => {
    assert.equal(NAME_PATTERN.test('{"$ne": null}'), false)
  })

  test('rejects script-tag content', () => {
    assert.equal(NAME_PATTERN.test('<script>alert(1)</script>'), false)
  })
})
