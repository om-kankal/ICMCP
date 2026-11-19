import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { SettingsProvider } from './context/SettingsContext'
import { AcademicYearProvider } from './context/AcademicYearContext'
import Login from './components/auth/Login'
import ResetPassword from './components/auth/ResetPassword'
import Sidebar from './components/layout/Sidebar'
import TopNav from './components/layout/TopNav'
import AdminDashboard from './components/dashboard/AdminDashboard'
import Overview from './components/dashboard/Overview'
import CommitteeRegistration from './components/committees/CommitteeRegistration'
import CommitteeDetail from './components/admin/CommitteeDetail'
import UserManagement from './components/admin/UserManagement'
import AllMinutes from './components/admin/AllMinutes'
import AgendaMaker from './components/documents/AgendaMaker'
import MomMaker from './components/documents/MomMaker'
import WorkAssign from './components/work/WorkAssign'
import MyCommittees from './components/committees/MyCommittees'
import CommitteeMembers from './components/committees/CommitteeMembers'
import NoticeBoard from './components/notices/NoticeBoard'
import NewsEvents from './components/news/NewsEvents'
import ScheduleMeeting from './components/meetings/ScheduleMeeting'
import ConductMeeting from './components/meetings/ConductMeeting'
import ProfileSettings from './components/profile/ProfileSettings'
import MailApp from './components/mail/MailApp'
import Spinner from './components/shared/Spinner'

const VIEW_LABELS = {
  dashboard: 'Compliance Dashboard',
  overview: 'Dashboard',
  mail: 'Mail',
  committees: 'Committee Registry',
  'committee-detail': 'Committee Detail',
  'my-committees': 'My Committees',
  members: 'Committee Members',
  notices: 'Notice Board',
  news: 'News, Events & Announcements',
  users: 'User Management',
  'all-minutes': 'All Meeting Documents',
  'agenda-maker': 'Agenda Maker',
  'mom-maker': 'MoM Maker',
  'work-assign': 'Work Assign',
  schedule: 'Schedule Meeting',
  conduct: 'Conduct Meeting',
  profile: 'My Profile'
}

function toUiRole(backendRole) {
  if (backendRole === 'Admin') return 'admin'
  if (backendRole === 'Coordinator') return 'coordinator'
  return 'member'
}

function AuthenticatedApp() {
  const { user, logout } = useAuth()
  const role = toUiRole(user.role)
  const [view, setView] = useState(role === 'admin' ? 'dashboard' : 'overview')
  const [selectedCommitteeId, setSelectedCommitteeId] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Set when the person clicks a title in the dashboard's scrolling updates
  // ticker — tells NoticeBoard/NewsEvents which item to auto-open once its
  // data has loaded, then is cleared so it doesn't re-trigger on revisit.
  const [focusItem, setFocusItem] = useState(null)

  // Guard against landing on a view the current role can't access (e.g.
  // after switching accounts) by falling back to that role's default page.
  // 'profile' is intentionally excluded — every role can always reach it.
  useEffect(() => {
    const allowed = {
      admin: [
        'dashboard',
        'mail',
        'committees',
        'committee-detail',
        'members',
        'notices',
        'news',
        'users',
        'all-minutes',
        'agenda-maker',
        'mom-maker',
        'schedule',
        'conduct'
      ],
      coordinator: [
        'overview',
        'mail',
        'my-committees',
        'committee-detail',
        'members',
        'work-assign',
        'notices',
        'news',
        'agenda-maker',
        'mom-maker',
        'schedule',
        'conduct'
      ],
      member: [
        'overview',
        'mail',
        'my-committees',
        'committee-detail',
        'work-assign',
        'notices',
        'news',
        'agenda-maker',
        'mom-maker',
        'conduct'
      ]
    }
    if (view !== 'profile' && !allowed[role].includes(view)) {
      setView(role === 'admin' ? 'dashboard' : 'overview')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  function goToCommitteeDetail(committeeId) {
    setSelectedCommitteeId(committeeId)
    setView('committee-detail')
  }

  function goToCommitteeRegistry() {
    setSelectedCommitteeId(null)
    setView(role === 'admin' ? 'committees' : 'my-committees')
  }

  /** Ticker item click → jump to the right section and auto-open that item. */
  function openUpdateItem(item) {
    setFocusItem(item)
    setView(item.type === 'notice' ? 'notices' : 'news')
  }

  return (
    <AcademicYearProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar view={view} setView={setView} role={role} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="lg:pl-64">
        <TopNav
          setMobileOpen={setMobileOpen}
          user={user}
          onLogout={logout}
          onOpenProfile={() => setView('profile')}
          viewLabel={VIEW_LABELS[view]}
        />

        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          {view === 'dashboard' && role === 'admin' && (
            <AdminDashboard onViewCommitteeDetail={goToCommitteeDetail} onOpenUpdateItem={openUpdateItem} />
          )}
          {view === 'overview' && (role === 'coordinator' || role === 'member') && (
            <Overview onViewCommitteeDetail={goToCommitteeDetail} onOpenUpdateItem={openUpdateItem} />
          )}
          {view === 'mail' && <MailApp currentUserId={user.id} />}
          {view === 'committees' && role === 'admin' && <CommitteeRegistration onViewDetails={goToCommitteeDetail} />}
          {view === 'my-committees' && (role === 'coordinator' || role === 'member') && (
            <MyCommittees onViewDetails={goToCommitteeDetail} />
          )}
          {view === 'committee-detail' && selectedCommitteeId && (
            <CommitteeDetail committeeId={selectedCommitteeId} onBack={goToCommitteeRegistry} />
          )}
          {view === 'members' && (role === 'admin' || role === 'coordinator') && <CommitteeMembers />}
          {view === 'notices' && (
            <NoticeBoard
              role={role}
              focusId={focusItem?.type === 'notice' ? focusItem.id : null}
              onFocusHandled={() => setFocusItem(null)}
            />
          )}
          {view === 'news' && (
            <NewsEvents
              role={role}
              focusId={focusItem?.type === 'news' ? focusItem.id : null}
              onFocusHandled={() => setFocusItem(null)}
            />
          )}
          {view === 'users' && role === 'admin' && <UserManagement />}
          {view === 'all-minutes' && role === 'admin' && <AllMinutes onViewDetails={goToCommitteeDetail} />}
          {view === 'agenda-maker' && <AgendaMaker />}
          {view === 'mom-maker' && <MomMaker />}
          {view === 'work-assign' && (role === 'coordinator' || role === 'member') && <WorkAssign role={role} />}
          {view === 'schedule' && (role === 'admin' || role === 'coordinator') && <ScheduleMeeting />}
          {view === 'conduct' && <ConductMeeting />}
          {view === 'profile' && <ProfileSettings />}
        </main>
      </div>
      </div>
    </AcademicYearProvider>
  )
}

function Gate() {
  const { user, bootstrapping } = useAuth()

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner label="Resuming your session…" size="lg" />
      </div>
    )
  }

  return user ? <AuthenticatedApp /> : <Login />
}

export default function App() {
  // This app doesn't use a router — a reset-password link (emailed on bulk
  // import, see bulkImportController.js) is just ?resetToken=... on the
  // base URL. Checked here, before AuthProvider's session bootstrap even
  // runs, so the link works whether or not anyone is currently signed in.
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('resetToken'))

  if (resetToken) {
    return (
      <ThemeProvider>
        <ResetPassword
          token={resetToken}
          onDone={() => {
            const url = new URL(window.location.href)
            url.searchParams.delete('resetToken')
            window.history.replaceState({}, '', url.toString())
            setResetToken(null)
          }}
        />
      </ThemeProvider>
    )
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <SettingsProvider>
          <Gate />
        </SettingsProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
