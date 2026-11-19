import { useEffect, useRef, useState } from 'react'
import { X, Download, Pencil, Loader2, Plus, Trash2, Printer } from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import {
  fetchNotice,
  fetchAgenda,
  fetchMinutes,
  fetchCommitteeReport,
  fetchNewsDocument,
  saveBlob
} from '../../services/documentService'
import { updateScheduleDetails, updateMinutesDetails } from '../../services/meetingService'
import { extractErrorMessage } from '../../services/apiClient'
import { meetingTypes } from '../../data/mockData'
import { sanitizeHtml } from '../../utils/sanitizeHtml'

const inputClasses =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-100'

const FETCHERS = {
  notice: (meeting) => fetchNotice(meeting._id),
  agenda: (meeting) => fetchAgenda(meeting._id),
  mom: (meeting) => fetchMinutes(meeting._id),
  report: (_meeting, extra) => fetchCommitteeReport(extra.committeeId, extra.academicYear),
  news: (post) => fetchNewsDocument(post._id)
}

const TITLES = {
  notice: 'Notice',
  agenda: 'Agenda',
  mom: 'Minutes of Meeting',
  report: 'Compliance Report',
  news: 'News / Announcement'
}

// Only per-meeting documents built from editable fields support the
// edit-and-regenerate loop; the Compliance Report is a computed rollup and
// News/Announcement posts are edited from their own section, not here.
const EDITABLE_TYPES = new Set(['notice', 'agenda', 'mom'])

export default function DocumentPreviewModal({
  docType,
  meeting,
  committeeId,
  academicYear,
  onClose,
  onContentUpdated,
  autoPrint
}) {
  const [state, setState] = useState('loading') // loading | preview | edit | saving
  const [html, setHtml] = useState('')
  const [blob, setBlob] = useState(null)
  const [filename, setFilename] = useState('document.docx')
  const [error, setError] = useState(null)
  const hasAutoPrinted = useRef(false)

  async function loadPreview() {
    setState('loading')
    setError(null)
    try {
      const fetcher = FETCHERS[docType]
      const { blob: fetchedBlob, filename: fetchedName } = await fetcher(meeting, { committeeId, academicYear })
      const arrayBuffer = await fetchedBlob.arrayBuffer()
      // Lazy-loaded: mammoth is only needed here, in the preview modal, so
      // keeping it out of the main bundle keeps first-load fast.
      const mammoth = await import('mammoth')
      const result = await mammoth.convertToHtml({ arrayBuffer })
      setHtml(sanitizeHtml(result.value))
      setBlob(fetchedBlob)
      setFilename(fetchedName)
      setState('preview')
    } catch (err) {
      setError(extractErrorMessage(err))
      setState('preview')
    }
  }

  useEffect(() => {
    loadPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType, meeting?._id])

  useEffect(() => {
    if (autoPrint && state === 'preview' && !error && !hasAutoPrinted.current) {
      hasAutoPrinted.current = true
      // Let the preview HTML actually paint before invoking the print dialog.
      setTimeout(() => window.print(), 150)
    }
  }, [autoPrint, state, error])

  function handleDownload() {
    if (blob) saveBlob(blob, filename)
  }

  function handlePrint() {
    window.print()
  }

  async function handleEditSaved() {
    onContentUpdated?.()
    await loadPreview() // regenerate + reconvert + re-render with the updated content
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-popover">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
              {TITLES[docType]} Preview
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{filename}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {state === 'loading' && <Spinner label="Generating document…" size="lg" />}
          {error && <ErrorBanner message={error} onRetry={loadPreview} />}

          {state === 'preview' && !error && (
            <div
              className="docx-preview print-target rounded-lg border border-slate-100 dark:border-slate-800 bg-white p-6 text-slate-900 shadow-inner"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}

          {state === 'edit' && (
            <EditForm
              docType={docType}
              meeting={meeting}
              onCancel={() => setState('preview')}
              onSaved={handleEditSaved}
            />
          )}
        </div>

        {(state === 'preview' || state === 'loading') && !error && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 p-5">
            {EDITABLE_TYPES.has(docType) ? (
              <button
                onClick={() => setState('edit')}
                disabled={state === 'loading'}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                <Pencil className="h-4 w-4" /> Edit Content
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handlePrint}
                disabled={state === 'loading' || !blob}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                onClick={handleDownload}
                disabled={state === 'loading' || !blob}
                className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Download .docx
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function EditForm({ docType, meeting, onCancel, onSaved }) {
  const isMinutes = docType === 'mom'

  const [venue, setVenue] = useState(meeting.venue || '')
  const [type, setType] = useState(meeting.type || meetingTypes[0])
  const [scheduledDate, setScheduledDate] = useState(meeting.scheduledDate?.slice(0, 10) || '')
  const [agendaItems, setAgendaItems] = useState(meeting.agendaItems?.length ? [...meeting.agendaItems] : [''])

  const [minutesText, setMinutesText] = useState(meeting.minutesText || '')
  const [actionItems, setActionItems] = useState(
    meeting.actionTakenItems?.length ? [...meeting.actionTakenItems] : [{ item: '', responsible: '', status: 'Pending' }]
  )
  const [membersPresent, setMembersPresent] = useState(meeting.membersPresent?.length ? [...meeting.membersPresent] : [''])
  const [membersAbsent, setMembersAbsent] = useState(meeting.membersAbsent?.length ? [...meeting.membersAbsent] : [''])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (isMinutes) {
        await updateMinutesDetails(meeting._id, {
          minutesText,
          actionTakenItems: actionItems.filter((a) => a.item.trim()),
          membersPresent: membersPresent.map((m) => m.trim()).filter(Boolean),
          membersAbsent: membersAbsent.map((m) => m.trim()).filter(Boolean)
        })
      } else {
        await updateScheduleDetails(meeting._id, {
          venue,
          type,
          scheduledDate,
          agendaItems: agendaItems.map((a) => a.trim()).filter(Boolean)
        })
      }
      onSaved()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {!isMinutes && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Scheduled Date</label>
              <input type="date" className={inputClasses} value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Meeting Type</label>
              <select className={inputClasses} value={type} onChange={(e) => setType(e.target.value)}>
                {meetingTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Venue</label>
              <input className={inputClasses} value={venue} onChange={(e) => setVenue(e.target.value)} />
            </div>
          </div>
          <ListEditor label="Agenda Items" values={agendaItems} setValues={setAgendaItems} />
        </>
      )}

      {isMinutes && (
        <>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Minutes / Proceedings</label>
            <textarea rows={5} className={inputClasses} value={minutesText} onChange={(e) => setMinutesText(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ListEditor label="Members Present" values={membersPresent} setValues={setMembersPresent} />
            <ListEditor label="Members Absent" values={membersAbsent} setValues={setMembersAbsent} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Action Taken Report</label>
              <button
                type="button"
                onClick={() => setActionItems((prev) => [...prev, { item: '', responsible: '', status: 'Pending' }])}
                className="text-xs font-semibold text-brand-700 dark:text-brand-400"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-2">
              {actionItems.map((a, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2">
                  <input
                    className={inputClasses}
                    placeholder="Action item"
                    value={a.item}
                    onChange={(e) =>
                      setActionItems((prev) => prev.map((x, i) => (i === idx ? { ...x, item: e.target.value } : x)))
                    }
                  />
                  <input
                    className={inputClasses}
                    placeholder="Responsible"
                    value={a.responsible}
                    onChange={(e) =>
                      setActionItems((prev) => prev.map((x, i) => (i === idx ? { ...x, responsible: e.target.value } : x)))
                    }
                  />
                  <select
                    className={inputClasses}
                    value={a.status}
                    onChange={(e) =>
                      setActionItems((prev) => prev.map((x, i) => (i === idx ? { ...x, status: e.target.value } : x)))
                    }
                  >
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setActionItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-slate-400 hover:text-status-overdue"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {error && <ErrorBanner message={error} />}

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving…' : 'Save & Regenerate Preview'}
        </button>
      </div>
    </div>
  )
}

function ListEditor({ label, values, setValues }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</label>
        <button
          type="button"
          onClick={() => setValues((prev) => [...prev, ''])}
          className="flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-400"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
      <div className="space-y-2">
        {values.map((v, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              className={inputClasses}
              value={v}
              onChange={(e) => setValues((prev) => prev.map((x, i) => (i === idx ? e.target.value : x)))}
            />
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => setValues((prev) => prev.filter((_, i) => i !== idx))}
                className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-slate-400 hover:text-status-overdue"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
