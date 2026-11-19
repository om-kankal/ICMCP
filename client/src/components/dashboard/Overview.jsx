import { useEffect, useState } from 'react'
import { Building2, ArrowRight } from 'lucide-react'
import CollegeBanner from './CollegeBanner'
import UpdatesFeed from './UpdatesFeed'
import UpdatesTicker from './UpdatesTicker'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import { listCommittees } from '../../services/committeeService'
import { extractErrorMessage } from '../../services/apiClient'

export default function Overview({ onViewCommitteeDetail, onOpenUpdateItem }) {
  const [committees, setCommittees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
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
      <CollegeBanner />
      <UpdatesTicker onOpenItem={onOpenUpdateItem} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-card">
          <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">My Committees</h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Committees you're assigned to</p>

          {loading && <Spinner label="Loading…" />}
          {!loading && error && <ErrorBanner message={error} onRetry={load} />}
          {!loading && !error && (
            <ul className="space-y-2.5">
              {committees.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500">You haven't been assigned to a committee yet.</p>
              )}
              {committees.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => onViewCommitteeDetail?.(c.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2.5 text-left hover:border-brand-200 hover:bg-brand-50/40 dark:hover:bg-slate-800"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{c.name}</p>
                      <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                        {c.meetingsHeld}/{c.meetingsRequired} meetings this year
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="xl:col-span-2">
          <UpdatesFeed />
        </div>
      </div>
    </div>
  )
}
