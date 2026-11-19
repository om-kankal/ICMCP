import axios from 'axios'
import { apiClient } from './apiClient'
import { saveBlob } from './documentService'

/** Every academic year that has committee data, plus the computed "current" one. */
export async function listAcademicYears() {
  const res = await apiClient.get('/admin/academic-years')
  return res.data.data // { years: [...], current }
}

/** Step 1 — uploads the sheet for a given academic year, gets back a per-row analysis. Nothing is written yet. */
export async function analyzeBulkImport(file, academicYear, defaultDomain) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('academicYear', academicYear)
  if (defaultDomain) formData.append('defaultDomain', defaultDomain)
  const res = await apiClient.post('/admin/bulk-import/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return res.data.data
}

/** Step 2 — applies a previously-analyzed batch. `rows` (optional) carries inline edits made in the review table. */
export async function commitBulkImport(batchId, rows) {
  const res = await apiClient.post('/admin/bulk-import/commit', { batchId, rows })
  return res.data.data
}

/** Downloads what /analyze parsed, in the same format the import expects, so it can be fixed in Excel and re-uploaded. */
export async function downloadBulkImportDraft(batchId) {
  const res = await apiClient.get('/admin/bulk-import/export-draft', {
    params: { batchId },
    responseType: 'blob'
  })
  saveBlob(res.data, `bulk-import-draft-${Date.now()}.xlsx`)
}

/** Downloads the committee/user roster as an .xlsx, same shape as the import sheet. */
export async function exportCommitteesExcel(filters = {}) {
  const params = {}
  if (filters.committeeIds?.length) params.committeeIds = filters.committeeIds.join(',')
  if (filters.role) params.role = filters.role
  if (filters.designation) params.designation = filters.designation
  if (filters.academicYear) params.academicYear = filters.academicYear

  const res = await apiClient.get('/admin/bulk-import/export', { params, responseType: 'blob' })
  const disposition = res.headers['content-disposition'] || ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  saveBlob(res.data, match ? match[1] : 'committees-export.xlsx')
}

// --- Public reset-password-by-link (no auth token yet at this point) ---
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export async function checkResetToken(token) {
  const res = await axios.get(`${API_URL}/auth/reset-password/${encodeURIComponent(token)}`)
  return res.data.data
}

export async function applyResetToken(token, newPassword) {
  const res = await axios.post(`${API_URL}/auth/reset-password`, { token, newPassword })
  return res.data.message
}
