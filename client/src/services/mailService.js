import axios from 'axios'
import { apiClient, getAccessToken } from './apiClient'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export async function listMail(folder, q) {
  const res = await apiClient.get('/mail', { params: { folder, q: q || undefined } })
  return res.data.data
}

export async function getUnreadCount() {
  const res = await apiClient.get('/mail/unread-count')
  return res.data.data.count
}

export async function searchContacts(q) {
  const res = await apiClient.get('/mail/contacts', { params: { q: q || undefined } })
  return res.data.data
}

export async function getMailThread(id) {
  const res = await apiClient.get(`/mail/${id}`)
  return res.data.data
}

export async function createMail(payload) {
  const res = await apiClient.post('/mail', payload)
  return res.data.data
}

export async function updateDraft(id, payload) {
  const res = await apiClient.patch(`/mail/${id}`, payload)
  return res.data.data
}

export async function sendDraft(id) {
  const res = await apiClient.post(`/mail/${id}/send`)
  return res.data.data
}

export async function updateMailState(id, payload) {
  const res = await apiClient.patch(`/mail/${id}/state`, payload)
  return res.data.data
}

export async function permanentlyDeleteMail(id) {
  await apiClient.delete(`/mail/${id}`)
}

/** Full presigned-upload round trip for a mail attachment — same pattern as meetingService.uploadFile. */
export async function uploadAttachment(file, onProgress) {
  const presignRes = await apiClient.post('/uploads/presign', {
    fileType: 'MailAttachment',
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream'
  })
  const { uploadUrl, storageKey, cloudUrl } = presignRes.data.data

  await axios.put(`${API_URL.replace(/\/api$/, '')}${uploadUrl}`, file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      Authorization: `Bearer ${getAccessToken()}`
    },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100))
    }
  })

  return {
    storageKey,
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    cloudUrl
  }
}

export function resolveAttachmentUrl(cloudUrl) {
  if (!cloudUrl) return null
  return `${API_URL.replace(/\/api$/, '')}${cloudUrl}`
}
