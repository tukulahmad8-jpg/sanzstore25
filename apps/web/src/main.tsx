import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import './styles/globals.css'
import { useThemeStore } from './stores/theme.store'
import { useAuthStore } from './stores/auth.store'

const queryClient = new QueryClient()

// Setelah ada deploy baru, tab yang masih terbuka masih mengacu ke nama file lama yang sudah
// tidak ada ("Failed to fetch dynamically imported module"). Muat ulang satu kali supaya
// mengambil versi terbaru. Batas 10 detik mencegah reload berulang tanpa henti.
window.addEventListener('vite:preloadError', () => {
  try {
    const last = Number(sessionStorage.getItem('ss25_chunk_reload_at') || 0)
    if (Date.now() - last < 10000) return
    sessionStorage.setItem('ss25_chunk_reload_at', String(Date.now()))
  } catch {
    // sessionStorage tidak tersedia: tetap muat ulang sekali
  }
  window.location.reload()
})

useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) {
    queryClient.removeQueries({ queryKey: ['buyer-orders'] })
  }
})

useThemeStore.getState().hydrateTheme()
useAuthStore.getState().hydrate()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
)
