import { apiClient } from './apiClient'

export async function listNotices() {
  const res = await apiClient.get('/notices')
  return res.data.data
}

export async function createNotice(payload) {
  const res = await apiClient.post('/notices', payload)
  return res.data.data
}

export async function updateNotice(id, payload) {
  const res = await apiClient.patch(`/notices/${id}`, payload)
  return res.data.data
}

export async function deleteNotice(id) {
  await apiClient.delete(`/notices/${id}`)
}
