import { apiClient } from './apiClient'

export async function listUsers(role) {
  const res = await apiClient.get('/users', { params: role ? { role } : {} })
  return res.data.data
}

export async function createUser(payload) {
  const res = await apiClient.post('/users', payload)
  return res.data.data
}

/** Updates name, email, role, or designation for an existing user. */
export async function updateUser(id, payload) {
  const res = await apiClient.patch(`/users/${id}`, payload)
  return res.data.data
}

/** Sets exactly which committees a Coordinator/Member belongs to. */
export async function updateUserCommittees(id, committeeIds) {
  const res = await apiClient.patch(`/users/${id}/committees`, { committeeIds })
  return res.data.data
}

/** Atomically makes `id` the new Admin and demotes the caller to Coordinator. */
export async function transferAdminRole(id) {
  const res = await apiClient.post(`/users/${id}/transfer-admin`)
  return res.data.message
}

/** Admin-issued password reset — no OTP, since the admin isn't the account owner. */
export async function resetUserPassword(id, newPassword) {
  await apiClient.patch(`/users/${id}/reset-password`, { newPassword })
}

export async function deleteUser(id) {
  await apiClient.delete(`/users/${id}`)
}
