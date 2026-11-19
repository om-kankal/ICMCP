import { useMemo, useState } from 'react'
import { Search, ArrowUpRight, Send } from 'lucide-react'
import StatusBadge from '../shared/StatusBadge'
import ProgressBar from '../shared/ProgressBar'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import { escalateCommittee } from '../../services/committeeService'
import { extractErrorMessage } from '../../services/apiClient'

const FILTERS = ['all', 'compliant', 'due', 'overdue']

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CommitteeTable({ committees, loading, error, onRetry, onCommitteeUpdated, onViewDetails }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [escalatingId, setEscalatingId] = useState(null)
  const [escalateError, setEscalateError] = useState(null)

  const filtered = useMemo(() => {
    return (committees || []).filter((c) => {
      const matchesFilter = filter === 'all' || c.status === filter
      const matchesQuery =
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        (c.secretary || '').toLowerCase().includes(query.toLowerCase())
      return matchesFilter && matchesQuery
    })
  }, [committees, filter, query])

  async function handleEscalate(committee) {
    setEscalatingId(committee.id)
    setEscalateError(null)
    try {
      await escalateCommittee(committee.id)
      onCommitteeUpdated?.()
    } catch (err) {
      setEscalateError(extractErrorMessage(err))
    } finally {
      setEscalatingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card">
      <div className="flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">Committee Registry</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {loading ? 'Loading…' : `${filtered.length} of ${committees?.length || 0} committees shown`}
          </p>
        </div>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search committee or coordinator…"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 pl-9 pr-3 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:text-slate-500 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 sm:w-64"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1.5 capitalize transition-colors ${
                  filter === f ? 'bg-white dark:bg-slate-900 text-brand-800 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {escalateError && (
        <div className="p-5 pb-0">
          <ErrorBanner message={escalateError} />
        </div>
      )}

      {loading && <Spinner label="Loading committees…" />}
      {!loading && error && (
        <div className="p-5">
          <ErrorBanner message={error} onRetry={onRetry} />
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <th className="px-5 py-3">Committee</th>
                <th className="px-5 py-3">Coordinator</th>
                <th className="px-5 py-3">Last Conducted</th>
                <th className="px-5 py-3">Next Due</th>
                <th className="px-5 py-3">Progress</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((c) => (
                <tr key={c.id} className="group text-sm hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => onViewDetails?.(c.id)}
                      className="text-left font-medium text-slate-800 dark:text-slate-100 hover:text-brand-700 hover:underline"
                    >
                      {c.name}
                    </button>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{c.mandate}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-slate-700 dark:text-slate-200">{c.secretary}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{c.designation}</p>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{formatDate(c.lastMeeting)}</td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{formatDate(c.nextDue)}</td>
                  <td className="px-5 py-3.5">
                    <ProgressBar value={c.progress} status={c.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onViewDetails?.(c.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" /> Details
                      </button>
                      {c.status === 'overdue' && (
                        <button
                          onClick={() => handleEscalate(c)}
                          disabled={escalatingId === c.id}
                          className="flex items-center gap-1.5 rounded-lg bg-status-overdue px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-wait disabled:opacity-70"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {escalatingId === c.id ? 'Sending…' : 'Escalate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    No committees match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
