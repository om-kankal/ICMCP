import { useState } from 'react'
import { ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import SafeImage from '../shared/SafeImage'
import { resolveFileUrl } from '../../services/meetingService'

export default function Login() {
  const { login, authError } = useAuth()
  const { settings } = useSettings()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await login(email, password)
    } catch {
      // authError is surfaced via context; nothing else to do here.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white shadow-popover">
            {settings?.collegeLogoUrl ? (
              <SafeImage
                src={resolveFileUrl(settings.collegeLogoUrl)}
                alt={settings.collegeName || 'Logo'}
                className="h-full w-full object-contain p-1"
                fallback={<ShieldCheck className="h-7 w-7 text-brand-700" strokeWidth={2.25} />}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-brand-gradient text-white">
                <ShieldCheck className="h-7 w-7" strokeWidth={2.25} />
              </div>
            )}
          </div>
          <h1 className="whitespace-pre-line font-display text-xl font-bold text-white">
            {settings?.collegeName || 'ICMCP'}
          </h1>
          <p className="mt-1 text-xs text-brand-300">
            {settings?.collegeTagline || 'Institutional Committee Management & Compliance Portal'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white dark:bg-slate-900 p-7 shadow-popover">
          <h2 className="mb-1 font-display text-lg font-semibold text-slate-900 dark:text-white">Sign in</h2>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">Access your institution's compliance dashboard.</p>

          {authError && (
            <div className="mb-4 rounded-lg border border-status-overdueBorder bg-status-overdueBg px-3.5 py-2.5 text-xs font-medium text-status-overdue">
              {authError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Email</label>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@icmcp.edu"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 pr-10 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign In
          </button>

          <p className="mt-5 text-center text-[11px] text-slate-400 dark:text-slate-500">
            Created by <code className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5">npm run seed</code> on first run. Sign in,
            then create Coordinator and Member accounts from User Management.
          </p>
        </form>

        <LegalLinks />
      </div>
    </div>
  )
}

/** Terms of Service / Privacy Policy links — only shown once an Admin has configured them. */
function LegalLinks() {
  const { settings } = useSettings()
  if (!settings.tosUrl && !settings.privacyUrl) return null

  return (
    <p className="mt-5 flex justify-center gap-3 text-[11px] text-brand-300">
      {settings.tosUrl && (
        <a href={settings.tosUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">
          Terms of Service
        </a>
      )}
      {settings.tosUrl && settings.privacyUrl && <span>·</span>}
      {settings.privacyUrl && (
        <a href={settings.privacyUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">
          Privacy Policy
        </a>
      )}
    </p>
  )
}
