import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

// Capacitor — initialize on mobile
async function initApp() {
  if ((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Light })
    await StatusBar.setBackgroundColor({ color: '#4285f4' })
    await SplashScreen.hide()
  }
}

initApp().catch(console.warn)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

const rootElement = document.getElementById('app')!

// OAuth callback — bypass router entirely, show intent button
if (window.location.pathname === '/oauth' && window.location.hash.includes('access_token')) {
  const params = window.location.hash.slice(1)
  const isAndroid = /Android/i.test(navigator.userAgent)
  const intentUrl = `intent://oauth?${params}#Intent;scheme=com.ringcal.app;package=com.spiraldiary.app;end;`

  if (isAndroid) {
    setTimeout(() => { try { window.location.href = intentUrl } catch(_) {} }, 400)
  } else {
    window.opener?.postMessage(window.location.href, window.location.origin)
    window.close()
  }

  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 20, fontFamily: 'Arial, sans-serif', background: '#f0f4ff' }}>
      <p style={{ fontSize: 18, color: '#444', margin: 0 }}>מחבר לאפליקציה...</p>
      {isAndroid && (
        <a href={intentUrl} style={{ padding: '14px 28px', background: '#4285f4', color: '#fff', borderRadius: 14, textDecoration: 'none', fontSize: 18, fontWeight: 'bold' }}>
          פתח את RingCal
        </a>
      )}
    </div>
  )
} else {
  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
  })

  const root = ReactDOM.createRoot(rootElement)
  root.render(<RouterProvider router={router} />)
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
