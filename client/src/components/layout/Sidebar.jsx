import {
  LayoutDashboard,
  CalendarPlus,
  UploadCloud,
  Users,
  UserCog,
  ShieldCheck,
  X,
  Building2,
  FolderKanban,
  FileStack,
  Users2,
  Bell,
  Newspaper,
  ClipboardList,
  NotebookPen,
  ClipboardCheck,
  Mail
} from 'lucide-react'
import { useSettings } from '../../context/SettingsContext'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Compliance Dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { key: 'overview', label: 'Dashboard', icon: LayoutDashboard, roles: ['coordinator', 'member'] },
  { key: 'mail', label: 'Mail', icon: Mail, roles: ['admin', 'coordinator', 'member'] },
  { key: 'committees', label: 'Committee Registry', icon: Users, roles: ['admin'] },
  { key: 'my-committees', label: 'My Committees', icon: FolderKanban, roles: ['coordinator', 'member'] },
  { key: 'members', label: 'Committee Members', icon: Users2, roles: ['admin', 'coordinator'] },
  { key: 'work-assign', label: 'Work Assign', icon: ClipboardCheck, roles: ['coordinator', 'member'] },
  { key: 'notices', label: 'Notice Board', icon: Bell, roles: ['admin', 'coordinator', 'member'] },
  { key: 'news', label: 'News & Events', icon: Newspaper, roles: ['admin', 'coordinator', 'member'] },
  { key: 'users', label: 'User Management', icon: UserCog, roles: ['admin'] },
  { key: 'all-minutes', label: 'All Meeting Documents', icon: FileStack, roles: ['admin'] },
  { key: 'agenda-maker', label: 'Agenda Maker', icon: ClipboardList, roles: ['admin', 'coordinator', 'member'] },
  { key: 'mom-maker', label: 'MoM Maker', icon: NotebookPen, roles: ['admin', 'coordinator', 'member'] },
  { key: 'schedule', label: 'Schedule Meeting', icon: CalendarPlus, roles: ['admin', 'coordinator'] },
  { key: 'conduct', label: 'Conduct Meeting', icon: UploadCloud, roles: ['admin', 'coordinator', 'member'] }
]

export default function Sidebar({ view, setView, role, mobileOpen, setMobileOpen }) {
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role))

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-white">
          <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold text-white tracking-tight">ICMCP</p>
          <p className="text-[11px] text-brand-300">Compliance Portal</p>
        </div>
        <button
          className="ml-auto text-brand-300 hover:text-white lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        <p className="px-2.5 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wider text-brand-400">
          Menu
        </p>
        {items.map((item) => {
          const Icon = item.icon
          const active =
            view === item.key ||
            ((item.key === 'committees' || item.key === 'my-committees') && view === 'committee-detail')
          return (
            <button
              key={item.key}
              onClick={() => {
                setView(item.key)
                setMobileOpen(false)
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-white/10 text-white shadow-inner'
                  : 'text-brand-200 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="h-4.5 w-4.5" strokeWidth={2} />
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-300" />}
            </button>
          )
        })}
      </nav>

      <div className="mx-3 mb-4 rounded-lg border border-white/10 bg-white/5 p-3.5">
        <div className="flex items-center gap-2 text-brand-200">
          <Building2 className="h-4 w-4" strokeWidth={2} />
          <span className="text-xs font-semibold">NAAC / NBA Ready</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-brand-300">
          Generate Notice, Agenda, Minutes, and Compliance Reports straight from committee records.
        </p>
      </div>

      <SidebarLegalLinks />
    </div>
  )

  return (
    <>
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-brand-900 dark:bg-black">{content}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-brand-900 dark:bg-black shadow-popover">{content}</aside>
        </div>
      )}
    </>
  )
}

/** Terms of Service / Privacy Policy links — only shown once an Admin has configured them. */
function SidebarLegalLinks() {
  const { settings } = useSettings()
  if (!settings.tosUrl && !settings.privacyUrl) return null

  return (
    <div className="mx-3 mb-4 flex justify-center gap-3 text-[10px] text-brand-300">
      {settings.tosUrl && (
        <a href={settings.tosUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">
          Terms
        </a>
      )}
      {settings.tosUrl && settings.privacyUrl && <span>·</span>}
      {settings.privacyUrl && (
        <a href={settings.privacyUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">
          Privacy
        </a>
      )}
    </div>
  )
}
