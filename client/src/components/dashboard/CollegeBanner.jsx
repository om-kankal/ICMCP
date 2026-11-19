import { useSettings } from '../../context/SettingsContext'
import { resolveFileUrl } from '../../services/meetingService'
import SafeImage from '../shared/SafeImage'

export default function CollegeBanner() {
  const { settings } = useSettings()

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-7 text-center shadow-card">
      <SafeImage
        src={resolveFileUrl(settings.collegeLogoUrl)}
        alt={settings.collegeName}
        className="h-16 w-16 rounded-full border border-slate-200 dark:border-slate-700 bg-white object-contain p-1"
      />
      {/* Institution name may span multiple lines (an Admin-editable setting) */}
      <h1 className="whitespace-pre-line font-display text-2xl font-bold leading-tight text-slate-900 dark:text-white">
        {settings.collegeName}
      </h1>
      {settings.collegeTagline && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{settings.collegeTagline}</p>
      )}
    </div>
  )
}
