import { useCallback, useEffect, useState } from 'react'
import { Building2, PieChart, CalendarClock, CalendarCheck2 } from 'lucide-react'
import MetricCard from '../shared/MetricCard'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import ComplianceChart from './ComplianceChart'
import CommitteeTable from './CommitteeTable'
import CollegeBanner from './CollegeBanner'
import UpdatesFeed from './UpdatesFeed'
import UpdatesTicker from './UpdatesTicker'
import { getDashboardMetrics } from '../../services/dashboardService'
import { listCommittees } from '../../services/committeeService'
import { extractErrorMessage } from '../../services/apiClient'

export default function AdminDashboard({ onViewCommitteeDetail, onOpenUpdateItem }) {
  const [metrics, setMetrics] = useState(null)
  const [committees, setCommittees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [metricsData, committeesData] = await Promise.all([getDashboardMetrics(), listCommittees()])
      setMetrics(metricsData)
      setCommittees(committeesData)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex flex-col gap-5">
      <CollegeBanner />
      <UpdatesTicker onOpenItem={onOpenUpdateItem} />

      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">IQAC Compliance Dashboard</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Live overview of statutory committee activity across the institution.
        </p>
      </div>

      {loading && !metrics && <Spinner label="Loading dashboard…" size="lg" />}
      {!loading && error && !metrics && <ErrorBanner message={error} onRetry={load} />}

      {metrics && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Active Committees" value={metrics.totalCommittees} icon={Building2} tone="slate" />
            <MetricCard
              label="Overall Compliance"
              value={metrics.overallCompliance}
              suffix="%"
              icon={PieChart}
              tone="emerald"
            />
            <MetricCard label="Meetings Scheduled" value={metrics.totalScheduled} icon={CalendarClock} tone="amber" />
            <MetricCard label="Meetings Conducted" value={metrics.totalConducted} icon={CalendarCheck2} tone="slate" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-1">
              <ComplianceChart quarterly={metrics.quarterly} statusDistribution={metrics.statusDistribution} />
            </div>
            <div className="xl:col-span-2">
              <PriorityInsights committees={committees} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <CommitteeTable
                committees={committees}
                loading={false}
                error={null}
                onCommitteeUpdated={load}
                onViewDetails={onViewCommitteeDetail}
              />
            </div>
            <div className="xl:col-span-1">
              <UpdatesFeed />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Surfaces the most urgent committees (overdue first, then due-soon) from live data. */
function PriorityInsights({ committees }) {
  const toneMap = {
    overdue: 'border-status-overdueBorder bg-status-overdueBg text-status-overdue',
    due: 'border-status-dueBorder bg-status-dueBg text-status-due',
    compliant: 'border-status-compliantBorder bg-status-compliantBg text-status-compliant'
  }
  const noteFor = (c) => {
    if (c.status === 'overdue') {
      const days = c.nextDue ? Math.round((Date.now() - new Date(c.nextDue)) / 86400000) : null
      return days ? `Overdue by ${days} day${days === 1 ? '' : 's'} — escalation recommended.` : 'Currently overdue.'
    }
    if (c.status === 'due') {
      const days = c.nextDue ? Math.round((new Date(c.nextDue) - Date.now()) / 86400000) : null
      return days != null ? `Meeting due in ${days} day${days === 1 ? '' : 's'}.` : 'Meeting due soon.'
    }
    return `Fully compliant — ${c.meetingsHeld}/${c.meetingsRequired} meetings logged this year.`
  }

  const prioritized = [...(committees || [])]
    .sort((a, b) => {
      const rank = { overdue: 0, due: 1, compliant: 2 }
      return rank[a.status] - rank[b.status]
    })
    .slice(0, 4)

  return (
    <div className="h-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-card">
      <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">Priority Insights</h3>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Derived live from current committee compliance status</p>
      {prioritized.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">No committees registered yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {prioritized.map((c) => (
            <li key={c.id} className={`rounded-lg border p-3.5 ${toneMap[c.status]}`}>
              <p className="text-[13px] font-semibold">{c.name}</p>
              <p className="mt-1 text-xs leading-relaxed opacity-90">{noteFor(c)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
