import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { getUpdatesFeed } from '../../services/dashboardService'

/**
 * Below-the-institute-name marquee of notice/news/event/announcement
 * titles (scheduled meetings are deliberately excluded — those already
 * have their own dashboard panel). Clicking a title jumps straight to
 * that item in its section.
 */
export default function UpdatesTicker({ onOpenItem }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    let cancelled = false
    getUpdatesFeed()
      .then((feed) => {
        if (cancelled) return
        setItems(feed.filter((item) => item.kind !== 'meeting'))
      })
      .catch(() => {
        // Non-critical — the ticker just stays empty if the feed fails to load.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (items.length === 0) return null

  // Item list is duplicated so the CSS animation can loop seamlessly from
  // the end straight back into the start without a visible jump/reset.
  const looped = [...items, ...items]

  return (
    <div className="group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card">
      <div className="flex items-center">
        <div className="flex shrink-0 items-center gap-1.5 border-r border-slate-100 dark:border-slate-800 bg-brand-50 dark:bg-brand-900/30 px-3.5 py-2.5 text-xs font-semibold text-brand-800 dark:text-brand-300">
          <Megaphone className="h-3.5 w-3.5" /> Updates
        </div>
        <div className="relative flex-1 overflow-hidden py-2.5">
          <div className="ticker-track flex w-max items-center gap-8 whitespace-nowrap px-6 group-hover:[animation-play-state:paused]">
            {looped.map((item, idx) => (
              <button
                key={`${item.kind}-${item.id}-${idx}`}
                onClick={() => onOpenItem?.({ type: item.kind === 'notice' ? 'notice' : 'news', id: item.id })}
                className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-300 hover:underline"
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
