import { useEffect } from 'react'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { useAppStore } from '../store/useAppStore'
import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

const RTL_LANGS = new Set(['he', 'ar'])

function RootComponent() {
  const language = useAppStore(s => s.settings.language)

  useEffect(() => {
    const dir = RTL_LANGS.has(language) ? 'rtl' : 'ltr'
    document.documentElement.dir = dir
    document.documentElement.lang = language
  }, [language])

  // OAuth callback handler
  useEffect(() => {
    if (window.location.pathname === '/oauth' && window.location.hash.includes('access_token')) {
      const hash = window.location.hash
      const params = new URLSearchParams(hash.slice(1))
      const token = params.get('access_token')
      // Native Android: redirect to custom scheme → app catches via appUrlOpen intent
      if (token && /Android/i.test(navigator.userAgent)) {
        window.location.href = 'com.ringcal.app://oauth' + hash
        return
      }
      // Web popup: send token to opener
      if (token) {
        window.opener?.postMessage(window.location.href, window.location.origin)
        window.close()
      }
    }
  }, [])

  return (
    <div
      id="root"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Heebo', sans-serif",
      }}
    >
      <Outlet />
    </div>
  )
}
