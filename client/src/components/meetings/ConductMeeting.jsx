import { useEffect, useState } from 'react'
import { CalendarClock, Plus, Trash2, CheckCircle2, Loader2, ChevronLeft } from 'lucide-react'
import DropZone from '../upload/DropZone'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import MicButton from '../shared/MicButton'
import { listMeetings, conductMeeting } from '../../services/meetingService'
import { extractErrorMessage } from '../../services/apiClient'

const inputClasses =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ConductMeeting() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [selected, setSelected] = useState(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await listMeetings({ status: 'Scheduled' })
      setMeetings(data)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (selected) {
    return (
      <ConductForm
        meeting={selected}
        onBack={() => setSelected(null)}
        onConducted={() => {
          setSelected(null)
          load()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Conduct a Meeting</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Pick a scheduled meeting below to log attendance, minutes, action items, and upload the agenda, MoM, and
          photographic evidence.
        </p>
      </div>

      {loading && <Spinner label="Loading scheduled meetings…" size="lg" />}
      {!loading && loadError && <ErrorBanner message={loadError} onRetry={load} />}

      {!loading && !loadError && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card">
          <ul className="divide-y divide-slate-50">
            {meetings.map((m) => {
              const overdue = new Date(m.scheduledDate) < new Date()
              return (
                <li key={m._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        overdue ? 'bg-status-overdueBg text-status-overdue' : 'bg-status-dueBg text-status-due'
                      }`}
                    >
                      <CalendarClock className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{m.committeeRef?.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(m.scheduledDate)} · {m.type} · {m.venue || 'No venue set'}
                        {overdue && <span className="ml-1.5 font-semibold text-status-overdue">· Overdue</span>}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(m)}
                    className="rounded-lg bg-brand-800 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    Conduct This Meeting
                  </button>
                </li>
              )
            })}
            {meetings.length === 0 && (
              <li className="px-5 py-12 text-center text-sm text-slate-400 dark:text-slate-500">
                No meetings are currently scheduled. Ask a Coordinator to schedule one from "Schedule Meeting".
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function ConductForm({ meeting, onBack, onConducted }) {
  const [actualDate, setActualDate] = useState(new Date().toISOString().slice(0, 10))
  const [membersPresent, setMembersPresent] = useState([''])
  const [membersAbsent, setMembersAbsent] = useState([''])
  const [minutesText, setMinutesText] = useState('')
  const [actionItems, setActionItems] = useState([{ item: '', responsible: '', status: 'Pending' }])
  const [uploadedFiles, setUploadedFiles] = useState({ Agenda: [], MoM: [], Photo: [] })

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [done, setDone] = useState(false)

  function updateListField(setter, idx, value) {
    setter((prev) => prev.map((v, i) => (i === idx ? value : v)))
  }
  function addListField(setter) {
    setter((prev) => [...prev, ''])
  }
  function removeListField(setter, idx) {
    setter((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateActionItem(idx, field, value) {
    setActionItems((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)))
  }

  const allFiles = [...uploadedFiles.Agenda, ...uploadedFiles.MoM, ...uploadedFiles.Photo]
  const hasRequiredDocs = uploadedFiles.Agenda.length > 0 && uploadedFiles.MoM.length > 0

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)

    if (!hasRequiredDocs) {
      setSubmitError('Agenda and Minutes of Meeting documents are both required.')
      return
    }

    setSubmitting(true)
    try {
      await conductMeeting(meeting._id, {
        actualDate,
        membersPresent: membersPresent.map((m) => m.trim()).filter(Boolean),
        membersAbsent: membersAbsent.map((m) => m.trim()).filter(Boolean),
        minutesText,
        actionTakenItems: actionItems.filter((a) => a.item.trim()),
        files: allFiles.map((f) => ({
          fileType: f.fileType,
          storageKey: f.storageKey,
          originalName: f.originalName,
          mimeType: f.mimeType
        }))
      })
      setDone(true)
    } catch (err) {
      setSubmitError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-20 text-center shadow-card">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-status-compliantBg text-status-compliant">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2} />
        </div>
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Meeting conducted &amp; logged</h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {meeting.committeeRef?.name} meeting is now marked Conducted. Minutes of Meeting can be generated from the
          committee's detail page.
        </p>
        <button
          onClick={onConducted}
          className="mt-6 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Back to Scheduled Meetings
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <button onClick={onBack} className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-brand-700">
        <ChevronLeft className="h-4 w-4" /> Back to scheduled meetings
      </button>

      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          Conduct: {meeting.committeeRef?.name}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Scheduled for {formatDate(meeting.scheduledDate)} · {meeting.venue || 'No venue set'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-card">
          <h3 className="mb-5 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">Agenda Reviewed</h3>
          <ul className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
            {(meeting.agendaItems || []).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
            {(!meeting.agendaItems || meeting.agendaItems.length === 0) && (
              <p className="text-slate-400 dark:text-slate-500">No agenda was recorded when this meeting was scheduled.</p>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-card">
          <h3 className="mb-5 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">Meeting Details</h3>
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Actual Date Held</label>
            <input
              type="date"
              required
              className={`${inputClasses} max-w-xs`}
              value={actualDate}
              onChange={(e) => setActualDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <AttendanceList
              label="Members Present"
              values={membersPresent}
              onChange={(idx, v) => updateListField(setMembersPresent, idx, v)}
              onAdd={() => addListField(setMembersPresent)}
              onRemove={(idx) => removeListField(setMembersPresent, idx)}
            />
            <AttendanceList
              label="Members Absent"
              values={membersAbsent}
              onChange={(idx, v) => updateListField(setMembersAbsent, idx, v)}
              onAdd={() => addListField(setMembersAbsent)}
              onRemove={(idx) => removeListField(setMembersAbsent, idx)}
            />
          </div>

          <div className="mt-6">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Minutes / Proceedings</label>
              <MicButton onAppend={(text) => setMinutesText((prev) => (prev ? `${prev} ${text}` : text))} />
            </div>
            <textarea
              rows={5}
              className={inputClasses}
              value={minutesText}
              onChange={(e) => setMinutesText(e.target.value)}
              placeholder="Summarize the discussion, decisions, and resolutions... or tap Speak to dictate"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">Action Taken Report</h3>
            <button
              type="button"
              onClick={() => setActionItems((prev) => [...prev, { item: '', responsible: '', status: 'Pending' }])}
              className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100"
            >
              <Plus className="h-3.5 w-3.5" /> Add Item
            </button>
          </div>
          <div className="space-y-3">
            {actionItems.map((a, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 p-3.5 sm:grid-cols-[1fr_1fr_auto_auto]">
                <input
                  className={inputClasses}
                  placeholder="Action item"
                  value={a.item}
                  onChange={(e) => updateActionItem(idx, 'item', e.target.value)}
                />
                <input
                  className={inputClasses}
                  placeholder="Responsible person"
                  value={a.responsible}
                  onChange={(e) => updateActionItem(idx, 'responsible', e.target.value)}
                />
                <select className={inputClasses} value={a.status} onChange={(e) => updateActionItem(idx, 'status', e.target.value)}>
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
                {actionItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setActionItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-slate-400 dark:text-slate-500 hover:border-status-overdueBorder hover:text-status-overdue"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-card">
          <h3 className="mb-5 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">Upload Supporting Documents</h3>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <DropZone
              label="Agenda Document"
              accept=".pdf"
              hint="PDF up to 15 MB"
              icon="file"
              fileType="Agenda"
              onFilesChange={(refs) => setUploadedFiles((prev) => ({ ...prev, Agenda: refs }))}
            />
            <DropZone
              label="Minutes of Meeting (MoM)"
              accept=".pdf"
              hint="PDF up to 15 MB"
              icon="file"
              fileType="MoM"
              onFilesChange={(refs) => setUploadedFiles((prev) => ({ ...prev, MoM: refs }))}
            />
            <DropZone
              label="Photographic Evidence"
              accept=".jpg,.jpeg,.png"
              hint="JPG or PNG, multiple allowed"
              multiple
              icon="image"
              fileType="Photo"
              onFilesChange={(refs) => setUploadedFiles((prev) => ({ ...prev, Photo: refs }))}
            />
          </div>
          {!hasRequiredDocs && (
            <p className="mt-4 text-xs text-status-due">Agenda and Minutes of Meeting are both required to submit.</p>
          )}
        </div>

        {submitError && <ErrorBanner message={submitError} />}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-status-compliant px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Submitting…' : 'Mark Conducted & Submit'}
          </button>
        </div>
      </form>
    </div>
  )
}

function AttendanceList({ label, values, onChange, onAdd, onRemove }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</label>
        <button type="button" onClick={onAdd} className="text-xs font-semibold text-brand-700 hover:text-brand-900">
          + Add
        </button>
      </div>
      <div className="space-y-2">
        {values.map((v, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input className={inputClasses} value={v} onChange={(e) => onChange(idx, e.target.value)} placeholder="Name" />
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-slate-400 dark:text-slate-500 hover:border-status-overdueBorder hover:text-status-overdue"
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
