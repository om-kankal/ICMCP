import { useEffect, useState } from 'react'
import { Users2, ShieldCheck } from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import SafeImage from '../shared/SafeImage'
import { listCommittees } from '../../services/committeeService'
import { resolveFileUrl } from '../../services/meetingService'
import { extractErrorMessage } from '../../services/apiClient'

function initialsFor(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

function PersonCard({ person, position }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-800 p-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-gradient text-xs font-semibold text-white">
        {person.avatarUrl ? (
          <SafeImage
            src={resolveFileUrl(person.avatarUrl)}
            alt={person.name}
            className="h-full w-full object-cover"
            fallback={initialsFor(person.name)}
          />
        ) : (
          initialsFor(person.name)
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{person.name}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{position}</p>
        {person.designation && (
          <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">{person.designation}</p>
        )}
      </div>
    </div>
  )
}

export default function CommitteeMembers() {
  const [committees, setCommittees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setCommittees(await listCommittees())
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <Spinner label="Loading committee members…" size="lg" />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Committee Members</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Everyone assigned to your committees, with their photo and position.
        </p>
      </div>

      {committees.length === 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center shadow-card">
          <p className="text-sm text-slate-400 dark:text-slate-500">No committees to show yet.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {committees.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">
                <Users2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{c.name}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {(c.coordinators?.length || 0) + (c.members?.length || 0)} people
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {(c.coordinators || []).map((p) => (
                <PersonCard key={p._id} person={p} position="Coordinator" />
              ))}
              {(c.members || []).map((p) => (
                <PersonCard key={p._id} person={p} position="Member" />
              ))}
              {(c.coordinators?.length || 0) + (c.members?.length || 0) === 0 && (
                <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5" /> No one assigned to this committee yet.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
