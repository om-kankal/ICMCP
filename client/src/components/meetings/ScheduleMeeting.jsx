import { useEffect, useState } from 'react'
import { CalendarPlus, Plus, Trash2, CheckCircle2, Loader2 } from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import { listCommittees } from '../../services/committeeService'
import { scheduleMeeting } from '../../services/meetingService'
import { extractErrorMessage } from '../../services/apiClient'
import { meetingTypes } from '../../data/mockData'

const inputClasses =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100'

function currentAcademicYear() {
  const now = new Date()
  const startYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

function quarterFor(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const month = date.getMonth()
  let q
  if (month >= 5 && month <= 7) q = 1
  else if (month >= 8 && month <= 10) q = 2
  else if (month === 11 || month <= 1) q = 3
  else q = 4
  const startYear = month >= 5 ? date.getFullYear() : date.getFullYear() - 1
  return `Q${q} ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

export default function ScheduleMeeting() {
  const [committees, setCommittees] = useState([])
  const [loadingCommittees, setLoadingCommittees] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [form, setForm] = useState({
    committeeRef: '',
    scheduledDate: '',
    venue: '',
    type: meetingTypes[0]
  })
  const [agendaItems, setAgendaItems] = useState([''])

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function loadCommittees() {
    setLoadingCommittees(true)
    setLoadError(null)
    try {
      const data = await listCommittees()
      setCommittees(data)
      setForm((prev) => ({ ...prev, committeeRef: prev.committeeRef || data[0]?.id || '' }))
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setLoadingCommittees(false)
    }
  }

  useEffect(() => {
    loadCommittees()
  }, [])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function updateAgendaItem(idx, value) {
    setAgendaItems((prev) => prev.map((item, i) => (i === idx ? value : item)))
  }

  function addAgendaItem() {
    setAgendaItems((prev) => [...prev, ''])
  }

  function removeAgendaItem(idx) {
    setAgendaItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)

    const cleanedAgenda = agendaItems.map((a) => a.trim()).filter(Boolean)
    if (cleanedAgenda.length === 0) {
      setSubmitError('Add at least one agenda item before scheduling.')
      return
    }

    setSubmitting(true)
    try {
      const academicYear = currentAcademicYear()
      const meeting = await scheduleMeeting({
        committeeRef: form.committeeRef,
        scheduledDate: form.scheduledDate,
        venue: form.venue,
        type: form.type,
        quarter: quarterFor(form.scheduledDate) || `Q1 ${academicYear}`,
        academicYear,
        agendaItems: cleanedAgenda
      })
      const committeeName = committees.find((c) => c.id === form.committeeRef)?.name || 'Committee'
      setSuccess(`${committeeName} meeting scheduled for ${new Date(form.scheduledDate).toLocaleDateString('en-IN')}.`)
      setForm({ committeeRef: form.committeeRef, scheduledDate: '', venue: '', type: meetingTypes[0] })
      setAgendaItems([''])
      void meeting
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setSubmitError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingCommittees) return <Spinner label="Loading committees…" size="lg" />
  if (loadError) return <ErrorBanner message={loadError} onRetry={loadCommittees} />

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Schedule a Meeting</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Set a date, venue, and agenda. A Notice and Agenda document can be generated immediately — the meeting
          moves to "Conducted" once someone logs the minutes and evidence afterward.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-card">
        <h3 className="mb-5 flex items-center gap-2 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
          <CalendarPlus className="h-4 w-4 text-brand-700" /> Meeting Details
        </h3>

        {committees.length === 0 ? (
          <p className="rounded-lg border border-status-dueBorder bg-status-dueBg p-4 text-sm text-status-due">
            No committees are registered yet. Ask an Admin to register a committee first.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Committee</label>
                <select className={inputClasses} value={form.committeeRef} onChange={(e) => update('committeeRef', e.target.value)}>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Meeting Type</label>
                <select className={inputClasses} value={form.type} onChange={(e) => update('type', e.target.value)}>
                  {meetingTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Scheduled Date</label>
                <input
                  type="date"
                  required
                  className={inputClasses}
                  value={form.scheduledDate}
                  onChange={(e) => update('scheduledDate', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Venue</label>
                <input
                  className={inputClasses}
                  value={form.venue}
                  onChange={(e) => update('venue', e.target.value)}
                  placeholder="e.g. Committee Room, Admin Block"
                />
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Agenda Items</label>
                <button
                  type="button"
                  onClick={addAgendaItem}
                  className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </button>
              </div>
              <div className="space-y-2.5">
                {agendaItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">{idx + 1}.</span>
                    <input
                      className={inputClasses}
                      value={item}
                      onChange={(e) => updateAgendaItem(idx, e.target.value)}
                      placeholder="Agenda item to discuss"
                    />
                    {agendaItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAgendaItem(idx)}
                        className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-slate-400 dark:text-slate-500 hover:border-status-overdueBorder hover:text-status-overdue"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {submitError && (
              <div className="mt-5">
                <ErrorBanner message={submitError} />
              </div>
            )}

            <div className="mt-8 flex justify-end border-t border-slate-100 dark:border-slate-800 pt-5">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Scheduling…' : 'Schedule Meeting'}
              </button>
            </div>
          </>
        )}
      </form>

      {success && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-status-compliantBorder bg-white dark:bg-slate-900 px-4 py-3 shadow-popover">
          <CheckCircle2 className="h-5 w-5 text-status-compliant" />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Meeting scheduled</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{success}</p>
          </div>
        </div>
      )}
    </div>
  )
}
