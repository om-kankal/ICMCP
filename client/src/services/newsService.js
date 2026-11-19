import { apiClient } from './apiClient'

export async function listNewsEvents(category) {
  const res = await apiClient.get('/news', { params: category ? { category } : {} })
  return res.data.data
}

export async function createNewsEvent(payload) {
  const res = await apiClient.post('/news', payload)
  return res.data.data
}

export async function updateNewsEvent(id, payload) {
  const res = await apiClient.patch(`/news/${id}`, payload)
  return res.data.data
}

export async function deleteNewsEvent(id) {
  await apiClient.delete(`/news/${id}`)
}
