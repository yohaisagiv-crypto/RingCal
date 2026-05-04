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
