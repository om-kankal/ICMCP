import { useState } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import { exportCommitteesExcel } from '../../services/bulkImportService'
import { useAcademicYear } from '../../context/AcademicYearContext'
import { extractErrorMessage } from '../../services/apiClient'
import ErrorBanner from '../shared/ErrorBanner'

const inputClasses =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100'

/**
 * Filters are additive on top of the committee-based export sheet: role
 * narrows which members are listed per committee, designation likewise.
 * committeeIds restricts to a specific set of committees. Leaving
 * everything blank exports every active committee.
 */
export default function ExportUsersModal({ committees, onClose }) {
  const { years, selectedYear } = useAcademicYear()
  const [academicYear, setAcademicYear] = useState(selectedYear || '')
  const [role, setRole] = useState('')
  const [designation, setDesignation] = useState('')
  const [committeeIds, setCommitteeIds] = useState([])
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  function toggleCommittee(id) {
    setCommitteeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleExport() {
    setError(null)
    setExporting(true)
    try {
      await exportCommitteesExcel({
        committeeIds: committeeIds.length ? committeeIds : undefined,
        role: role || undefined,
        designation: designation || undefined,
        academicYear: academicYear || undefined
      })
      onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-popover">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Download className="h-5 w-5 text-brand-700" />
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">Export to Excel</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && <ErrorBanner message={error} />}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Leave every filter blank to export all active committees. The file uses the same column layout as the
            bulk-import sheet, with department-wise and co-ordinator-wise counts at the bottom.
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Academic Year</label>
            <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className={inputClasses}>
              <option value="">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Role (filters which members are listed)
            </label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClasses}>
              <option value="">Any role</option>
              <option value="Coordinator">Coordinator</option>
              <option value="Member">Member</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Designation</label>
            <input
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Assistant Professor"
              className={inputClasses}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Committees ({committeeIds.length === 0 ? 'all' : committeeIds.length})
            </label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 py-1">
              {committees.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={committeeIds.includes(c.id)}
                    onChange={() => toggleCommittee(c.id)}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  <span className="truncate">{c.name}</span>
                </label>
              ))}
              {committees.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">No committees registered yet.</p>
              )}
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Preparing…' : 'Download .xlsx'}
          </button>
        </div>
      </div>
    </div>
  )
}
