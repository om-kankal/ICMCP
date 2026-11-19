import { useEffect, useState } from 'react'
import { ClipboardList, CalendarClock, CalendarCheck2 } from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import DocumentPreviewModal from '../shared/DocumentPreviewModal'
import { listMeetings } from '../../services/meetingService'
import { extractErrorMessage } from '../../services/apiClient'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Agenda documents are generated on demand from a meeting's stored agenda
 * items — nothing here is a separate file that can go stale or disappear;
 * as long as the meeting record exists, its Agenda is always available.
 */
export default function AgendaMaker() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [previewMeeting, setPreviewMeeting] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setMeetings(await listMeetings())
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <Spinner label="Loading meetings…" size="lg" />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Agenda Maker</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Pick a meeting to write or edit its agenda items and generate a formatted Agenda document.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card">
        <ul className="divide-y divide-slate-50 dark:divide-slate-800">
          {meetings.map((m) => (
            <li key={m._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    m.status === 'Conducted'
                      ? 'bg-status-compliantBg text-status-compliant'
                      : 'bg-status-dueBg text-status-due'
                  }`}
                >
                  {m.status === 'Conducted' ? (
                    <CalendarCheck2 className="h-4.5 w-4.5" />
                  ) : (
                    <CalendarClock className="h-4.5 w-4.5" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{m.committeeRef?.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(m.scheduledDate)} · {m.type} · {m.quarter} · {m.agendaItems?.length || 0} agenda item
                    {m.agendaItems?.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewMeeting(m)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Create / View Agenda
              </button>
            </li>
          ))}
          {meetings.length === 0 && (
            <li className="px-5 py-14 text-center">
              <ClipboardList className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-400 dark:text-slate-500">No meetings to build an agenda for yet.</p>
            </li>
          )}
        </ul>
      </div>

      {previewMeeting && (
        <DocumentPreviewModal
          docType="agenda"
          meeting={previewMeeting}
          onClose={() => setPreviewMeeting(null)}
          onContentUpdated={load}
        />
      )}
    </div>
  )
}
