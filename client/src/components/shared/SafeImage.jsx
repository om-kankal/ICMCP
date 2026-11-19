import { useState } from 'react'

/**
 * Drop-in replacement for <img> that renders `fallback` instead of a broken
 * image icon when the src is missing or fails to load — e.g. an
 * avatarUrl/collegeLogoUrl pointing at an upload that isn't on disk
 * (a fresh deployment, or a database restored without its file storage).
 */
export default function SafeImage({ src, alt, className, fallback }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) return fallback ?? null

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
}
