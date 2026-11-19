/**
 * SECURITY (CWE-79 / OWASP A03 — XSS, defense-in-depth): DocumentPreviewModal
 * renders mammoth's docx→HTML conversion via dangerouslySetInnerHTML. The
 * documents themselves are built server-side from plain-text TextRuns (the
 * `docx` package XML-escapes those), so this isn't directly exploitable
 * today — but rendering any HTML blob via dangerouslySetInnerHTML without a
 * sanitization pass is a latent risk if that assumption ever changes (a new
 * doc-generation path, a manipulated .docx, etc). This strips the concrete
 * XSS vectors — <script>/<style>/<iframe>/<object>/<embed> tags, inline
 * event handler attributes (onclick, onerror, ...), and javascript:/data:
 * URLs in href/src — without pulling in a new dependency.
 */
export function sanitizeHtml(html) {
  if (!html) return ''

  const doc = new DOMParser().parseFromString(html, 'text/html')

  doc.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((el) => el.remove())

  doc.querySelectorAll('*').forEach((el) => {
    ;[...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name)
      } else if ((name === 'href' || name === 'src') && /^(javascript|data|vbscript):/i.test(value)) {
        el.removeAttribute(attr.name)
      }
    })
  })

  return doc.body.innerHTML
}
