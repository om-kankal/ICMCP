import { apiClient } from './apiClient'
import { uploadFile } from './meetingService'

export async function getSettings() {
  const res = await apiClient.get('/settings')
  return res.data.data
}

/** Updates the institution name (multi-line), Terms of Service URL, and Privacy Policy URL. */
export async function updateInstitutionalSettings(payload) {
  const res = await apiClient.patch('/settings', payload)
  return res.data.data
}

/** Uploads a college logo image and links it as the active logo (Admin only). */
export async function uploadCollegeLogo(file, onProgress) {
  const uploaded = await uploadFile(file, 'Logo', onProgress)
  const res = await apiClient.patch('/settings/logo', { storageKey: uploaded.storageKey })
  return res.data.data
}
