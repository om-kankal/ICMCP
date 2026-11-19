import { apiClient } from './apiClient'
import { uploadFile } from './meetingService'

/** Name / designation only — email changes go through the OTP flow below. */
export async function updateProfile(payload) {
  const res = await apiClient.patch('/auth/profile', payload)
  return res.data.data
}

/** Step 1 of an email change: sends a 6-digit code to the NEW address. */
export async function requestEmailChangeOtp(newEmail, currentPassword) {
  const res = await apiClient.post('/auth/email/request-otp', { newEmail, currentPassword })
  return res.data.message
}

/** Step 2: confirms the code and applies the email change. */
export async function confirmEmailChangeOtp(otp) {
  const res = await apiClient.post('/auth/email/verify-otp', { otp })
  return res.data.data
}

/** Step 1 of a password change: sends a 6-digit code to the account's current email. */
export async function requestPasswordChangeOtp(currentPassword, newPassword) {
  const res = await apiClient.post('/auth/password/request-otp', { currentPassword, newPassword })
  return res.data.message
}

/** Step 2: confirms the code and applies the password change. */
export async function confirmPasswordChangeOtp(otp) {
  await apiClient.post('/auth/password/verify-otp', { otp })
}

export async function updatePreferences(payload) {
  const res = await apiClient.patch('/auth/preferences', payload)
  return res.data.data
}

/** Uploads an avatar image via the existing presigned-upload flow, then links it to the account. */
export async function uploadAvatar(file, onProgress) {
  const uploaded = await uploadFile(file, 'Avatar', onProgress)
  const res = await apiClient.patch('/auth/avatar', { storageKey: uploaded.storageKey })
  return res.data.data
}
