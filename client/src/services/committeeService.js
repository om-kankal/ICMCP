import { apiClient } from './apiClient'

export async function listCommittees(academicYear) {
  const res = await apiClient.get('/committees', { params: academicYear ? { academicYear } : undefined })
  return res.data.data
}

export async function getCommitteeOverview(committeeId) {
  const res = await apiClient.get(`/committees/${committeeId}/overview`)
  return res.data.data
}

export async function getCommitteeHistory(committeeId) {
  const res = await apiClient.get(`/committees/${committeeId}/meetings`)
  return res.data.data
}

export async function createCommittee(payload) {
  const res = await apiClient.post('/committees', payload)
  return res.data.data
}

/** Updates committee-level details (name, mandate/type, academic year, cadence). */
export async function updateCommittee(committeeId, payload) {
  const res = await apiClient.patch(`/committees/${committeeId}`, payload)
  return res.data.data
}

/** Re-assigns the coordinator/member roster. */
export async function updateCommitteeMembers(committeeId, payload) {
  const res = await apiClient.patch(`/committees/${committeeId}/members`, payload)
  return res.data.data
}

export async function deleteCommittee(committeeId) {
  await apiClient.delete(`/committees/${committeeId}`)
}

export async function escalateCommittee(committeeId) {
  const res = await apiClient.post(`/committees/${committeeId}/escalate`)
  return res.data
}
