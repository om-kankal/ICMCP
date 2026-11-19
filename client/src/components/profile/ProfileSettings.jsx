import { useRef, useState } from 'react'
import { User, Mail, Lock, ImageIcon, Sun, Moon, Monitor, Loader2, CheckCircle2, ShieldCheck, Building2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useSettings } from '../../context/SettingsContext'
import {
  updateProfile,
  requestEmailChangeOtp,
  confirmEmailChangeOtp,
  requestPasswordChangeOtp,
  confirmPasswordChangeOtp,
  uploadAvatar
} from '../../services/profileService'
import { uploadCollegeLogo, updateInstitutionalSettings } from '../../services/settingsService'
import { resolveFileUrl } from '../../services/meetingService'
import { extractErrorMessage } from '../../services/apiClient'
import ErrorBanner from '../shared/ErrorBanner'
import SafeImage from '../shared/SafeImage'

const inputClasses =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900'

const cardClasses = 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-card'

function initialsFor(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

function Toast({ message }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-status-compliantBorder bg-white dark:bg-slate-900 dark:border-status-compliant px-4 py-3 shadow-popover">
      <CheckCircle2 className="h-5 w-5 text-status-compliant" />
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{message}</p>
    </div>
  )
}

export default function ProfileSettings() {
  const { user, updateLocalUser } = useAuth()
  const [toast, setToast] = useState(null)

  function flashToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">My Profile</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Manage your account details, password, photo, and interface preferences.
        </p>
      </div>

      <AvatarSection user={user} updateLocalUser={updateLocalUser} onSaved={() => flashToast('Photo updated')} />
      <BasicInfoSection user={user} updateLocalUser={updateLocalUser} onSaved={() => flashToast('Profile updated')} />
      <EmailSection user={user} updateLocalUser={updateLocalUser} onSaved={() => flashToast('Email address updated')} />
      <PasswordSection onSaved={() => flashToast('Password changed')} />
      {user.role === 'Admin' && <BrandingSection onSaved={() => flashToast('College logo updated')} />}
      <AppearanceSection />

      <Toast message={toast} />
    </div>
  )
}

function AvatarSection({ user, updateLocalUser, onSaved }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const updated = await uploadAvatar(file)
      updateLocalUser(updated)
      onSaved()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className={cardClasses}>
      <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
        <ImageIcon className="h-4 w-4 text-brand-700 dark:text-brand-400" /> Profile Photo
      </h3>
      <div className="flex items-center gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-gradient text-lg font-semibold text-white">
          {user.avatarUrl ? (
            <SafeImage
              src={resolveFileUrl(user.avatarUrl)}
              alt={user.name}
              className="h-full w-full object-cover"
              fallback={initialsFor(user.name)}
            />
          ) : (
            initialsFor(user.name)
          )}
        </div>
        <div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? 'Uploading…' : 'Change Photo'}
          </button>
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">JPG or PNG</p>
        </div>
      </div>
      {error && <div className="mt-4"><ErrorBanner message={error} /></div>}
    </div>
  )
}

function BasicInfoSection({ user, updateLocalUser, onSaved }) {
  const [name, setName] = useState(user.name)
  const [designation, setDesignation] = useState(user.designation || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const updated = await updateProfile({ name, designation })
      updateLocalUser(updated)
      onSaved()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cardClasses}>
      <h3 className="mb-5 flex items-center gap-2 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
        <User className="h-4 w-4 text-brand-700 dark:text-brand-400" /> Basic Information
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Full Name</label>
          <input className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Designation</label>
          <input className={inputClasses} value={designation} onChange={(e) => setDesignation(e.target.value)} />
        </div>
      </div>

      {error && <div className="mt-5"><ErrorBanner message={error} /></div>}

      <div className="mt-6 flex justify-end border-t border-slate-100 dark:border-slate-800 pt-5">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

/**
 * Two-step OTP flow: request a code (sent to the NEW email address, proving
 * ownership), then confirm it to actually apply the change.
 */
function EmailSection({ user, updateLocalUser, onSaved }) {
  const [stage, setStage] = useState('idle') // idle | awaiting-otp
  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  async function handleRequestOtp(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (newEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      setError('That is already your current email address.')
      return
    }
    setSubmitting(true)
    try {
      const message = await requestEmailChangeOtp(newEmail, currentPassword)
      setInfo(message)
      setStage('awaiting-otp')
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmOtp(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const updated = await confirmEmailChangeOtp(otp)
      updateLocalUser(updated)
      setStage('idle')
      setNewEmail('')
      setCurrentPassword('')
      setOtp('')
      setInfo(null)
      onSaved()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={cardClasses}>
      <h3 className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Mail className="h-4 w-4 text-brand-700 dark:text-brand-400" /> Email Address
      </h3>
      <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">
        Current: <span className="font-semibold text-slate-700 dark:text-slate-200">{user.email}</span>. Changing it
        requires a verification code sent to the new address.
      </p>

      {stage === 'idle' && (
        <form onSubmit={handleRequestOtp} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">New Email</label>
            <input
              type="email"
              required
              className={inputClasses}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new.email@institution.edu"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Current Password</label>
            <input
              type="password"
              required
              className={inputClasses}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          {error && <div className="sm:col-span-2"><ErrorBanner message={error} /></div>}

          <div className="sm:col-span-2 flex justify-end border-t border-slate-100 dark:border-slate-800 pt-5">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Sending code…' : 'Send Verification Code'}
            </button>
          </div>
        </form>
      )}

      {stage === 'awaiting-otp' && (
        <form onSubmit={handleConfirmOtp} className="space-y-4">
          {info && (
            <p className="rounded-lg border border-status-dueBorder bg-status-dueBg px-3.5 py-2.5 text-xs text-status-due">
              {info}
            </p>
          )}
          <div className="max-w-xs">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">6-Digit Code</label>
            <input
              required
              inputMode="numeric"
              maxLength={6}
              className={`${inputClasses} tracking-[0.3em] text-center font-semibold`}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
          </div>

          {error && <ErrorBanner message={error} />}

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-5">
            <button
              type="button"
              onClick={() => {
                setStage('idle')
                setOtp('')
                setError(null)
                setInfo(null)
              }}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Cancel / use a different email
            </button>
            <button
              type="submit"
              disabled={submitting || otp.length !== 6}
              className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Verifying…' : 'Verify & Update Email'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/** Password field with a show/hide toggle — used throughout the Change Password form. */
function PasswordInput({ label, value, onChange }) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          required
          className={`${inputClasses} pr-10`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

/**
 * Same two-step OTP pattern as email — the code is sent to the account's
 * existing email address, and nothing changes until it's confirmed.
 */
function PasswordSection({ onSaved }) {
  const [stage, setStage] = useState('idle')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  async function handleRequestOtp(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }
    setSubmitting(true)
    try {
      const message = await requestPasswordChangeOtp(currentPassword, newPassword)
      setInfo(message)
      setStage('awaiting-otp')
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmOtp(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await confirmPasswordChangeOtp(otp)
      setStage('idle')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setOtp('')
      setInfo(null)
      onSaved()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={cardClasses}>
      <h3 className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Lock className="h-4 w-4 text-brand-700 dark:text-brand-400" /> Change Password
      </h3>
      <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">
        A verification code is sent to your email before the new password takes effect.
      </p>

      {stage === 'idle' && (
        <form onSubmit={handleRequestOtp}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <PasswordInput
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
            <PasswordInput label="New Password" value={newPassword} onChange={setNewPassword} />
            <PasswordInput label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} />
          </div>

          {error && <div className="mt-5"><ErrorBanner message={error} /></div>}

          <div className="mt-6 flex justify-end border-t border-slate-100 dark:border-slate-800 pt-5">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Sending code…' : 'Send Verification Code'}
            </button>
          </div>
        </form>
      )}

      {stage === 'awaiting-otp' && (
        <form onSubmit={handleConfirmOtp} className="space-y-4">
          {info && (
            <p className="rounded-lg border border-status-dueBorder bg-status-dueBg px-3.5 py-2.5 text-xs text-status-due">
              {info}
            </p>
          )}
          <div className="max-w-xs">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">6-Digit Code</label>
            <input
              required
              inputMode="numeric"
              maxLength={6}
              className={`${inputClasses} tracking-[0.3em] text-center font-semibold`}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
          </div>

          {error && <ErrorBanner message={error} />}

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-5">
            <button
              type="button"
              onClick={() => {
                setStage('idle')
                setOtp('')
                setError(null)
                setInfo(null)
              }}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || otp.length !== 6}
              className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Verifying…' : 'Verify & Update Password'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/** Admin-only — upload the college logo used across the header and every generated document. */
function BrandingSection({ onSaved }) {
  const { settings, refresh } = useSettings()
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [logoError, setLogoError] = useState(null)

  const [collegeName, setCollegeName] = useState(settings.collegeName || '')
  const [tosUrl, setTosUrl] = useState(settings.tosUrl || '')
  const [privacyUrl, setPrivacyUrl] = useState(settings.privacyUrl || '')
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError(null)
    setUploading(true)
    try {
      await uploadCollegeLogo(file)
      await refresh()
      onSaved()
    } catch (err) {
      setLogoError(extractErrorMessage(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleSaveDetails(e) {
    e.preventDefault()
    setDetailsError(null)
    setSavingDetails(true)
    try {
      await updateInstitutionalSettings({ collegeName, tosUrl, privacyUrl })
      await refresh()
      onSaved()
    } catch (err) {
      setDetailsError(extractErrorMessage(err))
    } finally {
      setSavingDetails(false)
    }
  }

  return (
    <div className={cardClasses}>
      <h3 className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Building2 className="h-4 w-4 text-brand-700 dark:text-brand-400" /> Institutional Settings
      </h3>
      <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">
        The logo and institution name appear in the top navigation bar and on every generated Notice, Agenda,
        Minutes of Meeting, and Compliance Report.
      </p>

      <div className="flex items-center gap-5 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-white">
          {settings.collegeLogoUrl ? (
            <SafeImage
              src={resolveFileUrl(settings.collegeLogoUrl)}
              alt={settings.collegeName}
              className="h-full w-full object-contain p-1"
              fallback={<ShieldCheck className="h-7 w-7 text-slate-300 dark:text-slate-600" />}
            />
          ) : (
            <ShieldCheck className="h-7 w-7 text-slate-300 dark:text-slate-600" />
          )}
        </div>
        <div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? 'Uploading…' : 'Upload Logo'}
          </button>
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">JPG or PNG, square works best</p>
        </div>
      </div>
      {logoError && <div className="mt-4"><ErrorBanner message={logoError} /></div>}

      <form onSubmit={handleSaveDetails} className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Institution Name
          </label>
          <textarea
            rows={2}
            className={`${inputClasses} resize-y`}
            value={collegeName}
            onChange={(e) => setCollegeName(e.target.value)}
            placeholder="Supports multiple lines, e.g.&#10;Institute of Advanced Technology & Research&#10;(An Autonomous Institution)"
          />
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            Leave blank to use the default name configured on the server.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Terms of Service URL
            </label>
            <input
              type="url"
              className={inputClasses}
              value={tosUrl}
              onChange={(e) => setTosUrl(e.target.value)}
              placeholder="https://your-institute.edu/terms"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Privacy Policy URL
            </label>
            <input
              type="url"
              className={inputClasses}
              value={privacyUrl}
              onChange={(e) => setPrivacyUrl(e.target.value)}
              placeholder="https://your-institute.edu/privacy"
            />
          </div>
        </div>

        {detailsError && <ErrorBanner message={detailsError} />}

        <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-5">
          <button
            type="submit"
            disabled={savingDetails}
            className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
          >
            {savingDetails && <Loader2 className="h-4 w-4 animate-spin" />}
            {savingDetails ? 'Saving…' : 'Save Institutional Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor }
]

function AppearanceSection() {
  const { theme, setTheme } = useTheme()

  return (
    <div className={cardClasses}>
      <h3 className="mb-1 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">Appearance</h3>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Saved to your account — this follows you across devices.
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-xs font-semibold transition-colors ${
              theme === value
                ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand-300'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
