import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/oauth')({
  component: OAuthCallback,
})

function OAuthCallback() {
  const [intentUrl, setIntentUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token')) {
      setError(true)
      return
    }
    const params = hash.slice(1)
    const isAndroid = /Android/i.test(navigator.userAgent)
    if (isAndroid) {
      const url = 'intent://oauth?' + params + '#Intent;scheme=com.ringcal.app;package=com.spiraldiary.app;end;'
      setIntentUrl(url)
      // Also try auto-redirect (may be blocked, button is fallback)
      setTimeout(() => { window.location.href = url }, 300)
    } else {
      window.opener?.postMessage(window.location.href, window.location.origin)
      window.close()
    }
  }, [])

  if (error) return <div style={{ padding: 32, textAlign: 'center' }}>שגיאה — לא נמצא טוקן</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <p>מחבר לאפליקציה...</p>
      {intentUrl && (
        <a
          href={intentUrl}
          style={{ padding: '12px 24px', background: '#4285f4', color: 'white', borderRadius: 12, textDecoration: 'none', fontSize: 18, fontWeight: 'bold' }}
        >
          פתח את RingCal
        </a>
      )}
    </div>
  )
}
