import { apiClient } from './apiClient'
import { uploadFile } from './meetingService'

export async function listWorkAssignments() {
  const res = await apiClient.get('/work-assignments')
  return res.data.data
}

/** Coordinator only. */
export async function createWorkAssignment(payload) {
  const res = await apiClient.post('/work-assignments', payload)
  return res.data.data
}

/** Coordinator only — edits title/description/dueDate on work they assigned. */
export async function updateWorkAssignment(id, payload) {
  const res = await apiClient.patch(`/work-assignments/${id}`, payload)
  return res.data.data
}

/** The assigned Member only — updates status and/or optional proof. */
export async function updateWorkAssignmentStatus(id, payload) {
  const res = await apiClient.patch(`/work-assignments/${id}/status`, payload)
  return res.data.data
}

/** Coordinator only. */
export async function deleteWorkAssignment(id) {
  await apiClient.delete(`/work-assignments/${id}`)
}

/** Uploads an optional proof image via the existing presigned-upload flow. */
export async function uploadWorkProof(file, onProgress) {
  return uploadFile(file, 'WorkProof', onProgress)
}
