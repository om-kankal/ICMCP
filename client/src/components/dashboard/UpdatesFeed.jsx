import { useEffect, useState } from 'react'
import { CalendarClock, Megaphone, Newspaper, PartyPopper, Bell } from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import { getUpdatesFeed } from '../../services/dashboardService'
import { extractErrorMessage } from '../../services/apiClient'

const KIND_META = {
  meeting: { icon: CalendarClock, tone: 'text-brand-700 bg-brand-50 dark:bg-brand-900/40 dark:text-brand-300' },
  notice: { icon: Bell, tone: 'text-status-due bg-status-dueBg' },
  news: { icon: Newspaper, tone: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800' },
  event: { icon: PartyPopper, tone: 'text-status-compliant bg-status-compliantBg' },
  announcement: { icon: Megaphone, tone: 'text-status-overdue bg-status-overdueBg' }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function UpdatesFeed() {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setFeed(await getUpdatesFeed())
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
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card">
      <div className="border-b border-slate-100 dark:border-slate-800 p-5">
        <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
          Current News &amp; Updates
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Scheduled meetings, notices, news, events, and announcements
        </p>
      </div>

      {loading && <Spinner label="Loading updates…" />}
      {!loading && error && (
        <div className="p-5">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}
      {!loading && !error && (
        <ul className="divide-y divide-slate-50 dark:divide-slate-800">
          {feed.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              Nothing to show yet — check back soon.
            </li>
          )}
          {feed.map((item) => {
            const meta = KIND_META[item.kind] || KIND_META.notice
            const Icon = meta.icon
            return (
              <li key={`${item.kind}-${item.id}`} className="flex gap-3 px-5 py-3.5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                    <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {item.kind}
                    </span>
                  </div>
                  {item.detail && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{item.detail}</p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    {item.committeeName ? `${item.committeeName} · ` : ''}
                    {item.kind === 'meeting' || item.kind === 'event'
                      ? formatDate(item.eventDate || item.date)
                      : formatDate(item.date)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
