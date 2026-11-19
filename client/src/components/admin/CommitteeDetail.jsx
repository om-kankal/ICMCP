import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarClock, CalendarCheck2, FileText, FileCheck2, FileSpreadsheet, Eye } from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import StatusBadge from '../shared/StatusBadge'
import ProgressBar from '../shared/ProgressBar'
import DocumentPreviewModal from '../shared/DocumentPreviewModal'
import { getCommitteeOverview } from '../../services/committeeService'
import { extractErrorMessage } from '../../services/apiClient'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CommitteeDetail({ committeeId, onBack }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [preview, setPreview] = useState(null) // { docType, meeting } | { docType: 'report' }

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      setData(await getCommitteeOverview(committeeId))
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committeeId])

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onBack}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {loading && <Spinner label="Loading committee…" size="lg" />}
      {!loading && loadError && <ErrorBanner message={loadError} onRetry={load} />}

      {!loading && data && (
        <>
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-card sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">{data.name}</h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{data.type} · Academic Year {data.academicYear}</p>
              <div className="mt-3 flex items-center gap-3">
                <StatusBadge status={data.status} />
                <div className="w-40">
                  <ProgressBar value={data.progress} status={data.status} />
                </div>
              </div>
            </div>
            <button
              onClick={() => setPreview({ docType: 'report' })}
              className="flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Compliance Report
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Roster */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-card lg:col-span-1">
              <h3 className="mb-4 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">Assigned Team</h3>
              <ul className="space-y-2.5">
                {(data.coordinatorRefs || []).map((u) => (
                  <li key={u._id} className="rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2.5">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {u.name} <span className="text-[10px] font-bold text-brand-700 dark:text-brand-400">· COORDINATOR</span>
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{u.designation || u.email}</p>
                  </li>
                ))}
                {(data.memberRefs || []).map((u) => (
                  <li key={u._id} className="rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2.5">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{u.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{u.designation || u.email}</p>
                  </li>
                ))}
                {(!data.coordinatorRefs || data.coordinatorRefs.length === 0) &&
                  (!data.memberRefs || data.memberRefs.length === 0) && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">No one assigned.</p>
                  )}
              </ul>
            </div>

            {/* Scheduled + Conducted meetings */}
            <div className="flex flex-col gap-5 lg:col-span-2">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 p-5">
                  <CalendarClock className="h-4 w-4 text-status-due" />
                  <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Scheduled Meetings ({data.scheduledMeetings?.length || 0})
                  </h3>
                </div>
                <ul className="divide-y divide-slate-50 dark:divide-slate-800">
                  {(data.scheduledMeetings || []).map((m) => (
                    <li key={m._id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{formatDate(m.scheduledDate)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {m.type} · {m.quarter} · Venue: {m.venue || '—'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <DocButton label="Notice" icon={FileText} onClick={() => setPreview({ docType: 'notice', meeting: m })} />
                        <DocButton label="Agenda" icon={FileCheck2} onClick={() => setPreview({ docType: 'agenda', meeting: m })} />
                      </div>
                    </li>
                  ))}
                  {(!data.scheduledMeetings || data.scheduledMeetings.length === 0) && (
                    <li className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">No meetings currently scheduled.</li>
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 p-5">
                  <CalendarCheck2 className="h-4 w-4 text-status-compliant" />
                  <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Conducted Meetings ({data.conductedMeetings?.length || 0})
                  </h3>
                </div>
                <ul className="divide-y divide-slate-50 dark:divide-slate-800">
                  {(data.conductedMeetings || []).map((m) => (
                    <li key={m._id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{formatDate(m.actualDate)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {m.type} · {m.quarter} · {m.files?.length || 0} document{m.files?.length === 1 ? '' : 's'} attached
                        </p>
                      </div>
                      <DocButton label="Minutes of Meeting" icon={Eye} onClick={() => setPreview({ docType: 'mom', meeting: m })} />
                    </li>
                  ))}
                  {(!data.conductedMeetings || data.conductedMeetings.length === 0) && (
                    <li className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">No meetings conducted yet.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {preview && preview.docType === 'report' && (
        <DocumentPreviewModal
          docType="report"
          committeeId={committeeId}
          academicYear={data.academicYear}
          onClose={() => setPreview(null)}
        />
      )}
      {preview && preview.docType !== 'report' && (
        <DocumentPreviewModal
          docType={preview.docType}
          meeting={preview.meeting}
          onClose={() => setPreview(null)}
          onContentUpdated={load}
        />
      )}
    </div>
  )
}

function DocButton({ label, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
