import { NavLink } from 'react-router-dom'
import { Home, Search, BookOpen, CheckSquare, Settings, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/notebooks', icon: BookOpen, label: 'Notebooks' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav-safe fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-surface-1/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-screen-sm items-center justify-around px-2 py-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs transition-all active:scale-90',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                    isActive && 'scale-110',
                  )}
                />
                <span className={cn('relative font-medium', isActive && 'font-bold')}>
                  {label}
                  {isActive && (
                    <span className="absolute left-1/2 top-full mt-1 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-primary" />
                  )}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
