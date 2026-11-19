import { useEffect, useState } from 'react'
import { FolderKanban, CalendarClock, CalendarCheck2 } from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import StatusBadge from '../shared/StatusBadge'
import ProgressBar from '../shared/ProgressBar'
import { listCommittees } from '../../services/committeeService'
import { extractErrorMessage } from '../../services/apiClient'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MyCommittees({ onViewDetails }) {
  const [committees, setCommittees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // The API already scopes this to "committees I'm assigned to" for
      // non-Admin roles — no client-side filtering needed.
      setCommittees(await listCommittees())
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">My Committees</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Committees you're assigned to, with scheduled and conducted meeting activity.
        </p>
      </div>

      {loading && <Spinner label="Loading your committees…" size="lg" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {committees.map((c) => (
            <button
              key={c.id}
              onClick={() => onViewDetails?.(c.id)}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-left shadow-card hover:border-brand-300 dark:hover:border-brand-500"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">{c.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{c.mandate}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>

              <ProgressBar value={c.progress} status={c.status} />

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <CalendarClock className="h-3.5 w-3.5 text-status-due" />
                  {c.upcomingScheduled?.length || 0} scheduled
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <CalendarCheck2 className="h-3.5 w-3.5 text-status-compliant" />
                  {c.conductedCount || 0} conducted
                </div>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Last conducted: {formatDate(c.lastMeeting)}</p>
            </button>
          ))}

          {committees.length === 0 && (
            <div className="col-span-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center shadow-card">
              <FolderKanban className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You haven't been assigned to any committees yet. Ask an Admin to add you.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
