import { useEffect } from 'react'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { useAppStore } from '../store/useAppStore'
import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

const RTL_LANGS = new Set(['he', 'ar'])

function OAuthRedirect() {
  const params = window.location.hash.slice(1)
  const isAndroid = /Android/i.test(navigator.userAgent)
  const intentUrl = `intent://oauth?${params}#Intent;scheme=com.ringcal.app;package=com.spiraldiary.app;end;`

  useEffect(() => {
    if (isAndroid) setTimeout(() => { window.location.href = intentUrl }, 400)
    else {
      window.opener?.postMessage(window.location.href, '*')
      window.close()
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 20, fontFamily: 'Arial, sans-serif', background: '#f0f4ff' }}>
      <p style={{ fontSize: 18, color: '#333' }}>מחבר לאפליקציה...</p>
      {isAndroid && (
        <a
          href={intentUrl}
          style={{ padding: '14px 28px', background: '#4285f4', color: '#fff', borderRadius: 14, textDecoration: 'none', fontSize: 18, fontWeight: 'bold' }}
        >
          פתח את RingCal
        </a>
      )}
    </div>
  )
}

function RootComponent() {
  const language = useAppStore(s => s.settings.language)

  useEffect(() => {
    const dir = RTL_LANGS.has(language) ? 'rtl' : 'ltr'
    document.documentElement.dir = dir
    document.documentElement.lang = language
  }, [language])

  if (window.location.pathname === '/oauth' && window.location.hash.includes('access_token')) {
    return <OAuthRedirect />
  }

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
