import { apiClient } from './apiClient'

export async function listNotifications() {
  const res = await apiClient.get('/notifications')
  return res.data.data // { notifications, unreadCount }
}

export async function markNotificationRead(id) {
  const res = await apiClient.patch(`/notifications/${id}/read`)
  return res.data.data
}

export async function markAllNotificationsRead() {
  await apiClient.patch('/notifications/read-all')
}
