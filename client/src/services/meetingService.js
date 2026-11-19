import axios from 'axios'
import { apiClient, getAccessToken } from './apiClient'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

/** Full presigned-upload round trip for a single file — unchanged from before. */
export async function uploadFile(file, fileType, onProgress) {
  const presignRes = await apiClient.post('/uploads/presign', {
    fileType,
    fileName: file.name,
    mimeType: file.type
  })
  const { uploadUrl, storageKey, cloudUrl } = presignRes.data.data

  await axios.put(`${API_URL.replace(/\/api$/, '')}${uploadUrl}`, file, {
    headers: {
      'Content-Type': file.type,
      Authorization: `Bearer ${getAccessToken()}`
    },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100))
    }
  })

  return { fileType, storageKey, originalName: file.name, mimeType: file.type, cloudUrl }
}

export async function scheduleMeeting(payload) {
  const res = await apiClient.post('/meetings/schedule', payload)
  return res.data.data
}

export async function updateScheduleDetails(meetingId, payload) {
  const res = await apiClient.patch(`/meetings/${meetingId}/schedule-details`, payload)
  return res.data.data
}

export async function conductMeeting(meetingId, payload) {
  const res = await apiClient.patch(`/meetings/${meetingId}/conduct`, payload)
  return res.data.data
}

export async function updateMinutesDetails(meetingId, payload) {
  const res = await apiClient.patch(`/meetings/${meetingId}/minutes-details`, payload)
  return res.data.data
}

export async function listMeetings(params = {}) {
  const res = await apiClient.get('/meetings', { params })
  return res.data.data
}

export async function getMeeting(meetingId) {
  const res = await apiClient.get(`/meetings/${meetingId}`)
  return res.data.data
}

export function resolveFileUrl(cloudUrl) {
  if (!cloudUrl) return null
  return `${API_URL.replace(/\/api$/, '')}${cloudUrl}`
}
