import { useEffect, useMemo, useState } from 'react'
import { FileStack, ArrowUpDown, CalendarCheck2 } from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import DocumentPreviewModal from '../shared/DocumentPreviewModal'
import { listMeetings } from '../../services/meetingService'
import { extractErrorMessage } from '../../services/apiClient'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const SORT_OPTIONS = [
  { value: 'date', label: 'By Date' },
  { value: 'committee', label: 'By Committee' }
]

export default function AllMinutes({ onViewDetails }) {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [previewMeeting, setPreviewMeeting] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await listMeetings({ status: 'Conducted' })
      setMeetings(data)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const sortedMeetings = useMemo(() => {
    const copy = [...meetings]
    copy.sort((a, b) => {
      let comparison
      if (sortBy === 'committee') {
        comparison = (a.committeeRef?.name || '').localeCompare(b.committeeRef?.name || '')
      } else {
        comparison = new Date(a.actualDate) - new Date(b.actualDate)
      }
      return sortDir === 'asc' ? comparison : -comparison
    })
    return copy
  }, [meetings, sortBy, sortDir])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">All Meeting Documents</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Every conducted meeting across every committee — Notice, Agenda, and Minutes for each.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortBy === 'committee'
              ? sortDir === 'asc'
                ? 'A → Z'
                : 'Z → A'
              : sortDir === 'desc'
                ? 'Newest first'
                : 'Oldest first'}
          </button>
        </div>
      </div>

      {loading && <Spinner label="Loading minutes…" size="lg" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card">
          <ul className="divide-y divide-slate-50 dark:divide-slate-800">
            {sortedMeetings.map((m) => (
              <li key={m._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-status-compliantBg text-status-compliant">
                    <CalendarCheck2 className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <button
                      onClick={() => onViewDetails?.(m.committeeRef?._id)}
                      className="text-sm font-semibold text-slate-800 dark:text-slate-100 hover:text-brand-700 hover:underline"
                    >
                      {m.committeeRef?.name}
                    </button>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(m.actualDate)} · {m.type} · {m.quarter} · {m.files?.length || 0} document
                      {m.files?.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewMeeting(m)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Preview / Download
                </button>
              </li>
            ))}
            {sortedMeetings.length === 0 && (
              <li className="px-5 py-14 text-center">
                <FileStack className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="text-sm text-slate-400 dark:text-slate-500">No meetings have been conducted yet.</p>
              </li>
            )}
          </ul>
        </div>
      )}

      {previewMeeting && (
        <DocumentPreviewModal docType="mom" meeting={previewMeeting} onClose={() => setPreviewMeeting(null)} />
      )}
    </div>
  )
}
