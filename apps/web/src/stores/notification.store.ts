import { create } from 'zustand'

interface NotificationState {
  message: string | null
  show: (message: string) => void
  clear: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  message: null,
  show: (message) => {
    set({ message })
    window.setTimeout(() => set({ message: null }), 1800)
  },
  clear: () => set({ message: null }),
}))
