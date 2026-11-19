import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { listAcademicYears } from '../services/bulkImportService'
import { useAuth } from './AuthContext'

const AcademicYearContext = createContext(null)
const STORAGE_KEY = 'icmcp.selectedAcademicYear'

/**
 * The single source of truth for "which academic year is the Admin looking
 * at" — read by TopNav's year picker and passed down into whatever needs to
 * filter by year (CommitteeRegistration's list + create-form default, the
 * Bulk Import modal, the Export modal). Options come from real data
 * (Committee.distinct('academicYear') via GET /admin/academic-years), not a
 * hardcoded list, so a newly-imported year shows up automatically.
 */
export function AcademicYearProvider({ children }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const [years, setYears] = useState([])
  const [current, setCurrent] = useState('')
  const [selectedYear, setSelectedYearState] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!isAdmin) {
      setLoaded(true)
      return
    }
    try {
      const data = await listAcademicYears()
      setYears(data.years)
      setCurrent(data.current)
      setSelectedYearState((prev) => (prev && data.years.includes(prev) ? prev : data.current))
    } catch {
      // Non-critical — the picker just falls back to whatever was last selected.
    } finally {
      setLoaded(true)
    }
  }, [isAdmin])

  useEffect(() => {
    refresh()
  }, [refresh])

  function setSelectedYear(year) {
    setSelectedYearState(year)
    localStorage.setItem(STORAGE_KEY, year)
  }

  return (
    <AcademicYearContext.Provider value={{ years, current, selectedYear, setSelectedYear, refresh, loaded }}>
      {children}
    </AcademicYearContext.Provider>
  )
}

export function useAcademicYear() {
  const ctx = useContext(AcademicYearContext)
  if (!ctx) throw new Error('useAcademicYear must be used within an AcademicYearProvider')
  return ctx
}
