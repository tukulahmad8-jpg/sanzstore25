import { useNotificationStore } from '@/stores/notification.store'

export function Toast() {
  const message = useNotificationStore((state) => state.message)
  if (!message) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-[var(--text)] px-5 py-3 text-sm font-bold text-[var(--background)] shadow-soft">
      {message}
    </div>
  )
}
