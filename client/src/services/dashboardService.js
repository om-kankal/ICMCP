import { apiClient } from './apiClient'

export async function getDashboardMetrics() {
  const res = await apiClient.get('/dashboard/metrics')
  return res.data.data
}

/** Combined "current news & updates" feed — scheduled meetings, notices, news/events/announcements. */
export async function getUpdatesFeed() {
  const res = await apiClient.get('/dashboard/feed')
  return res.data.data
}
