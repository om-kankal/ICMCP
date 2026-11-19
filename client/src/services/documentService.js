import { apiClient } from './apiClient'

const ENDPOINTS = {
  notice: (meetingId) => `/documents/${meetingId}/notice`,
  agenda: (meetingId) => `/documents/${meetingId}/agenda`,
  mom: (meetingId) => `/documents/${meetingId}/mom`,
  report: (committeeId, academicYear) =>
    `/documents/committee/${committeeId}/report?academicYear=${encodeURIComponent(academicYear)}`,
  news: (postId) => `/documents/news/${postId}`
}

/**
 * Fetches the real, generated .docx as a blob — used for both the preview
 * (converted client-side to HTML via mammoth) and the eventual download, so
 * the exact same bytes the user previewed are what gets saved.
 */
async function fetchDocumentBlob(url) {
  const res = await apiClient.get(url, { responseType: 'blob' })
  const disposition = res.headers['content-disposition'] || ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match ? match[1] : 'document.docx'
  return { blob: res.data, filename }
}

export const fetchNotice = (meetingId) => fetchDocumentBlob(ENDPOINTS.notice(meetingId))
export const fetchAgenda = (meetingId) => fetchDocumentBlob(ENDPOINTS.agenda(meetingId))
export const fetchMinutes = (meetingId) => fetchDocumentBlob(ENDPOINTS.mom(meetingId))
export const fetchCommitteeReport = (committeeId, academicYear) =>
  fetchDocumentBlob(ENDPOINTS.report(committeeId, academicYear))
export const fetchNewsDocument = (postId) => fetchDocumentBlob(ENDPOINTS.news(postId))

/** Saves an already-fetched blob to disk via the browser's download prompt. */
export function saveBlob(blob, filename) {
  const blobUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(blobUrl)
}
