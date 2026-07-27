import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { Toaster } from '@/components/ui/toast'
import { AutoSync } from '@/components/sync/AutoSync'
import { AppChromeEnhancements } from './AppChromeEnhancements'

export function AppLayout() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <AutoSync />
      <AppChromeEnhancements />
      <OfflineBanner />
      <main className="flex-1 pb-20 pt-safe lg:pl-64">
        <Outlet />
      </main>
      <div className="lg:hidden">
        <BottomNav />
      </div>
      <Toaster
        position={typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches ? 'bottom-center' : 'top-center'}
        mobileOffset={16}
        toastOptions={{
          style: {
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-foreground)',
          },
        }}
      />
    </div>
  )
}
