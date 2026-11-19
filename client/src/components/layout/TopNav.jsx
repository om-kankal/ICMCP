import { useState, useRef, useEffect, useCallback } from 'react'
import { Menu, Bell, ChevronDown, LogOut, UserCog, CheckCheck } from 'lucide-react'
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/notificationService'
import { resolveFileUrl } from '../../services/meetingService'
import { useSettings } from '../../context/SettingsContext'
import { useAcademicYear } from '../../context/AcademicYearContext'
import SafeImage from '../shared/SafeImage'

function initialsFor(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function TopNav({ setMobileOpen, user, onLogout, onOpenProfile, viewLabel }) {
  const { settings } = useSettings()
  const { years, selectedYear, setSelectedYear } = useAcademicYear()
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const notifRef = useRef(null)
  const profileRef = useRef(null)

  const loadNotifications = useCallback(async () => {
    try {
      const data = await listNotifications()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      // Non-critical — the bell just stays at its last known state.
    }
  }, [])

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 60000) // poll every minute
    return () => clearInterval(interval)
  }, [loadNotifications])

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const levelDot = {
    compliant: 'bg-status-compliant',
    due: 'bg-status-due',
    overdue: 'bg-status-overdue',
    info: 'bg-brand-500'
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await onLogout()
    } finally {
      setLoggingOut(false)
    }
  }

  async function handleOpenNotifications() {
    const willOpen = !notifOpen
    setNotifOpen(willOpen)
    if (willOpen) await loadNotifications()
  }

  async function handleMarkRead(id) {
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await markNotificationRead(id)
    } catch {
      loadNotifications()
    }
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await markAllNotificationsRead()
    } catch {
      loadNotifications()
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 dark:border-[#8b8f92] bg-white/90 dark:bg-[#777B7E] px-4 backdrop-blur sm:px-6 relative">
      <button
        className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5.5 w-5.5" />
      </button>

      <div className="hidden sm:block">
        <h1 className="font-display text-[15px] font-semibold text-slate-900 dark:text-white">{viewLabel}</h1>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 md:flex">
        <SafeImage
          src={resolveFileUrl(settings.collegeLogoUrl)}
          alt={settings.collegeName}
          className="h-9 w-9 rounded-full border border-slate-200 dark:border-slate-500 bg-white object-contain p-0.5"
        />
        <span className="max-w-[280px] truncate font-display text-base font-bold text-slate-900 dark:text-white lg:max-w-[420px]">
          {(settings.collegeName || '').split('\n')[0]}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {years.length > 0 && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            title="Academic year — filters the committees and data you see"
            className="hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-400 sm:block"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                AY {y}
              </option>
            ))}
          </select>
        )}

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={handleOpenNotifications}
            className="relative rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-status-overdue text-[10px] font-bold text-white ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-popover">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</p>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                  </button>
                )}
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {notifications.length === 0 && (
                  <li className="px-4 py-8 text-center text-xs text-slate-400 dark:text-slate-500">You're all caught up.</li>
                )}
                {notifications.map((n) => (
                  <li
                    key={n._id}
                    onClick={() => !n.isRead && handleMarkRead(n._id)}
                    className={`flex cursor-pointer gap-3 border-b border-slate-50 dark:border-slate-800 px-4 py-3 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      n.isRead ? 'opacity-60' : ''
                    }`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${levelDot[n.level] || 'bg-slate-300'}`} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{timeAgo(n.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-gradient text-xs font-semibold text-white">
              {user.avatarUrl ? (
                <SafeImage
                  src={resolveFileUrl(user.avatarUrl)}
                  alt={user.name}
                  className="h-full w-full object-cover"
                  fallback={initialsFor(user.name)}
                />
              ) : (
                initialsFor(user.name)
              )}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{user.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{user.role}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 shadow-popover">
              <div className="px-4 py-2">
                <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{user.email}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">{user.designation || user.role}</p>
              </div>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button
                onClick={() => {
                  setProfileOpen(false)
                  onOpenProfile?.()
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <UserCog className="h-4 w-4 text-slate-400 dark:text-slate-500" /> My Profile
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-status-overdue hover:bg-status-overdueBg disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" /> {loggingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
