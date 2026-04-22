import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

// OAuth callback — handle BEFORE router renders
if (window.location.pathname === '/oauth' && window.location.hash.includes('access_token')) {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const token = params.get('access_token')
  if (token) {
    if (/Android/i.test(navigator.userAgent)) {
      window.location.href = 'com.ringcal.app://oauth' + window.location.hash
    } else {
      window.opener?.postMessage(window.location.href, window.location.origin)
      window.close()
    }
  }
}

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

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(<RouterProvider router={router} />)
}
