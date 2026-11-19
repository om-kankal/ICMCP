import { useRef, useState } from 'react'
import {
  X,
  FileSpreadsheet,
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Download,
  Pencil,
  FileCheck,
  Trash2
} from 'lucide-react'
import { analyzeBulkImport, commitBulkImport, downloadBulkImportDraft } from '../../services/bulkImportService'
import { useAcademicYear } from '../../context/AcademicYearContext'
import { extractErrorMessage } from '../../services/apiClient'
import ErrorBanner from '../shared/ErrorBanner'

const ACTION_TONE = {
  create: 'bg-status-compliantBg text-status-compliant border-status-compliantBorder',
  update: 'bg-status-dueBg text-status-due border-status-dueBorder',
  unchanged: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  'no-account': 'bg-status-overdueBg text-status-overdue border-status-overdueBorder',
  'skip-admin': 'bg-status-overdueBg text-status-overdue border-status-overdueBorder'
}

function ActionBadge({ action }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ACTION_TONE[action] || ACTION_TONE.unchanged}`}>
      {action}
    </span>
  )
}

const smallInput =
  'w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-1 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-400'

export default function BulkImportModal({ onClose, onCommitted }) {
  const { years, current: currentYear, refresh: refreshYears } = useAcademicYear()
  const [academicYear, setAcademicYear] = useState('')
  const [customYear, setCustomYear] = useState('')
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [defaultDomain, setDefaultDomain] = useState('indiraicem.ac.in')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null) // { batchId, rows, errors, summary }
  const [editedRows, setEditedRows] = useState(null) // deep-copied, editable version of analysis.rows
  const [downloadingDraft, setDownloadingDraft] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const effectiveYear = academicYear === '__custom__' ? customYear.trim() : academicYear || currentYear

  function handleFileSelected(selectedFile) {
    if (!selectedFile) return
    const isExcel = /\.(xlsx|xls)$/i.test(selectedFile.name)
    if (!isExcel) {
      setError('Please select an Excel (.xlsx or .xls) file.')
      return
    }
    setError(null)
    setFile(selectedFile)
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      handleFileSelected(droppedFile)
    }
  }

  async function handleAnalyze() {
    if (!file || !effectiveYear) return
    setError(null)
    setAnalyzing(true)
    try {
      const data = await analyzeBulkImport(file, effectiveYear, defaultDomain)
      setAnalysis(data)
      setEditedRows(JSON.parse(JSON.stringify(data.rows)))
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleDownloadDraft() {
    if (!analysis?.batchId) return
    setDownloadingDraft(true)
    try {
      await downloadBulkImportDraft(analysis.batchId)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setDownloadingDraft(false)
    }
  }

  async function handleCommit() {
    if (!analysis?.batchId) return
    setError(null)
    setCommitting(true)
    try {
      const result = await commitBulkImport(analysis.batchId, editedRows)
      setCommitResult(result)
      refreshYears()
      onCommitted?.()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setCommitting(false)
    }
  }

  function reset() {
    setFile(null)
    setAnalysis(null)
    setEditedRows(null)
    setCommitResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function updatePerson(rowIdx, personPath, field, value) {
    setEditedRows((prev) => {
      const next = [...prev]
      const row = { ...next[rowIdx] }
      if (personPath === 'coordinator') {
        row.coordinator = { ...row.coordinator, [field]: value }
      } else {
        const members = [...row.members]
        members[personPath] = { ...members[personPath], [field]: value }
        row.members = members
      }
      next[rowIdx] = row
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-popover">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 text-brand-700 dark:text-brand-400" />
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Bulk Import Committees &amp; Users
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4">
              <ErrorBanner message={error} />
            </div>
          )}

          {/* Step 3: committed */}
          {commitResult && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-status-compliant" />
              <h4 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Import complete</h4>
              <ul className="text-sm text-slate-600 dark:text-slate-300">
                <li>{commitResult.committeesWritten} committee(s) created or updated for AY {effectiveYear}</li>
                <li>{commitResult.usersCreated} new account(s) created</li>
                <li>{commitResult.usersUpdated} existing account(s) updated</li>
                <li>
                  {commitResult.emailsSent} welcome email(s) sent
                  {commitResult.emailsFailed > 0 && `, ${commitResult.emailsFailed} failed to send`}
                </li>
              </ul>
              <p className="max-w-sm text-xs text-slate-400 dark:text-slate-500">
                New accounts start on the shared default password and were emailed a link to set their own —
                they can't sign in until they do.
              </p>
              <button
                onClick={onClose}
                className="mt-2 rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Done
              </button>
            </div>
          )}

          {/* Step 1: year + upload */}
          {!analysis && !commitResult && (
            <div>
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Academic Year
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    >
                      <option value="">{currentYear} (current)</option>
                      {years.filter((y) => y !== currentYear).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                      <option value="__custom__">+ New academic year…</option>
                    </select>
                    {academicYear === '__custom__' && (
                      <input
                        autoFocus
                        placeholder="2027-28"
                        value={customYear}
                        onChange={(e) => setCustomYear(e.target.value)}
                        className="w-32 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Default Email Domain
                  </label>
                  <input
                    type="text"
                    value={defaultDomain}
                    onChange={(e) => setDefaultDomain(e.target.value)}
                    placeholder="indiraicem.ac.in"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Used for faculty members when the Excel sheet has no email column.
                  </p>
                </div>
              </div>

              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Upload your institutional portfolio or committee Excel file. Both formats with or without email columns are supported.
              </p>

              {/* Upload Drop Zone */}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  handleFileSelected(e.target.files?.[0])
                  e.target.value = ''
                }}
              />

              {!file ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                    isDragging
                      ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-brand-400 hover:bg-brand-50/30'
                  }`}
                >
                  <UploadCloud className="mb-2.5 h-9 w-9 text-brand-600 dark:text-brand-400" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <span className="text-brand-700 dark:text-brand-400 underline">Click to choose Excel file</span> or drag &amp; drop here
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Supports .xlsx or .xls (e.g. "Institute Level Portfolio and Committees")
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-950/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white shadow-sm">
                      <FileCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{file.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB · Ready to analyze
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      title="Remove file"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!file || !effectiveYear || analyzing}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing Excel sheet…
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4" />
                    Analyze sheet {file ? `(${file.name})` : ''}
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 2: analysis review */}
          {analysis && editedRows && !commitResult && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={reset}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Upload a different file
                </button>
                <button
                  onClick={handleDownloadDraft}
                  disabled={downloadingDraft}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {downloadingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Download to edit &amp; re-upload
                </button>
              </div>

              <p className="mb-4 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Pencil className="h-3.5 w-3.5" /> You can also fix names/mails directly in the table below, then
                confirm — no need to re-upload for small corrections.
              </p>

              <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <SummaryStat label="Committees to create" value={analysis.summary.committeesCreate} tone="create" />
                <SummaryStat label="Committees to update" value={analysis.summary.committeesUpdate} tone="update" />
                <SummaryStat label="Committees unchanged" value={analysis.summary.committeesUnchanged} tone="unchanged" />
                <SummaryStat label="Accounts to create" value={analysis.summary.usersCreate} tone="create" />
                <SummaryStat label="Accounts to update" value={analysis.summary.usersUpdate} tone="update" />
                <SummaryStat label="Members with no mail" value={analysis.summary.unlinkedMembers} tone="no-account" />
              </div>

              {analysis.errors.length > 0 && (
                <div className="mb-5 rounded-lg border border-status-overdueBorder bg-status-overdueBg p-3.5">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-status-overdue">
                    <AlertTriangle className="h-3.5 w-3.5" /> {analysis.errors.length} row(s) will be skipped entirely
                  </p>
                  <ul className="space-y-1 text-[11px] text-status-overdue">
                    {analysis.errors.map((e) => (
                      <li key={e.excelRow}>
                        Row {e.excelRow} ({e.committeeName || 'unnamed'}): {e.errors.join('; ')}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[11px] text-status-overdue">
                    These need a full committee name, co-ordinator name, and a valid co-ordinator mail — fix and
                    re-upload rather than editing inline (they didn't parse into a row to edit).
                  </p>
                </div>
              )}

              <div className="mb-5 max-h-[26rem] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Committee</th>
                      <th className="px-3 py-2">Co-ordinator</th>
                      <th className="px-3 py-2">Members</th>
                      <th className="px-3 py-2">Committee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {editedRows.map((row, rowIdx) => (
                      <tr key={row.excelRow}>
                        <td className="px-3 py-2 align-top font-medium text-slate-700 dark:text-slate-200">{row.committeeName}</td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <ActionBadge action={row.coordinator.action} />
                            </div>
                            <input
                              className={smallInput}
                              value={row.coordinator.name}
                              onChange={(e) => updatePerson(rowIdx, 'coordinator', 'name', e.target.value)}
                            />
                            <input
                              className={smallInput}
                              value={row.coordinator.mail}
                              onChange={(e) => updatePerson(rowIdx, 'coordinator', 'mail', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col gap-2">
                            {row.members.map((m, mIdx) => (
                              <div key={mIdx} className="flex flex-col gap-1 border-b border-slate-50 dark:border-slate-800 pb-1.5 last:border-0">
                                <div className="flex items-center gap-1.5">
                                  <ActionBadge action={m.action} />
                                  <span className="text-[10px] text-slate-400">{m.department}</span>
                                </div>
                                <input
                                  className={smallInput}
                                  value={m.name}
                                  onChange={(e) => updatePerson(rowIdx, mIdx, 'name', e.target.value)}
                                />
                                <input
                                  className={smallInput}
                                  placeholder="mail@example.com"
                                  value={m.mail}
                                  onChange={(e) => updatePerson(rowIdx, mIdx, 'mail', e.target.value)}
                                />
                              </div>
                            ))}
                            {row.members.length === 0 && <span className="text-slate-400">—</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <ActionBadge action={row.committee.action} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleCommit}
                disabled={committing}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
              >
                {committing && <Loader2 className="h-4 w-4 animate-spin" />}
                {committing ? 'Creating…' : `Confirm & create (${editedRows.length} committee(s), AY ${effectiveYear})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const STAT_TONE = {
  create: 'border-status-compliantBorder bg-status-compliantBg text-status-compliant',
  update: 'border-status-dueBorder bg-status-dueBg text-status-due',
  unchanged: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  'no-account': 'border-status-overdueBorder bg-status-overdueBg text-status-overdue'
}

function SummaryStat({ label, value, tone }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${STAT_TONE[tone] || STAT_TONE.unchanged}`}>
      <p className="text-lg font-semibold leading-none">{value ?? 0}</p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</p>
    </div>
  )
}
