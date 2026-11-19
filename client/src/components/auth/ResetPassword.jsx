import { useEffect, useState } from 'react'
import { ShieldCheck, Loader2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { checkResetToken, applyResetToken } from '../../services/bulkImportService'
import { extractErrorMessage } from '../../services/apiClient'

const inputClasses =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100'

/**
 * Reached via the "set your password" / "reset your password" link emailed
 * to a bulk-imported account (see bulkImportController.js) or one an Admin
 * reset. This app doesn't use a router, so App.jsx renders this component
 * directly when it spots ?resetToken=... in the URL, before anything else
 * (including the login gate) mounts.
 */
export default function ResetPassword({ token, onDone }) {
  const [checking, setChecking] = useState(true)
  const [tokenInfo, setTokenInfo] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    checkResetToken(token)
      .then((data) => {
        if (!cancelled) setTokenInfo(data)
      })
      .catch(() => {
        if (!cancelled) setTokenInfo({ valid: false })
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await applyResetToken(token, password)
      setSuccess(true)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-popover">
            <ShieldCheck className="h-6 w-6" strokeWidth={2.25} />
          </div>
          <h1 className="font-display text-xl font-semibold text-white">ICMCP</h1>
          <p className="text-sm text-brand-300">Set your account password</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white dark:bg-slate-900 p-7 shadow-popover">
          {checking && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-brand-700" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Checking your link…</p>
            </div>
          )}

          {!checking && !tokenInfo?.valid && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="h-10 w-10 text-status-overdue" />
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                This link is invalid or has expired
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ask your administrator to send you a new password-reset link, then return to the sign-in page.
              </p>
              <button
                onClick={onDone}
                className="mt-3 rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Back to sign in
              </button>
            </div>
          )}

          {!checking && tokenInfo?.valid && success && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-status-compliant" />
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Password set</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You can now sign in with your new password.
              </p>
              <button
                onClick={onDone}
                className="mt-3 rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Go to sign in
              </button>
            </div>
          )}

          {!checking && tokenInfo?.valid && !success && (
            <form onSubmit={handleSubmit}>
              <h2 className="mb-1 font-display text-lg font-semibold text-slate-900 dark:text-white">
                Hello, {tokenInfo.name}
              </h2>
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                Set a password for <span className="font-medium">{tokenInfo.email}</span>.
              </p>

              {error && (
                <div className="mb-4 rounded-lg border border-status-overdueBorder bg-status-overdueBg px-3.5 py-2.5 text-xs font-medium text-status-overdue">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClasses} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Confirm password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClasses}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Saving…' : 'Set password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
