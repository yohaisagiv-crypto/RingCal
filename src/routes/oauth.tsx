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
      // Show button only — Chrome Custom Tab blocks JS-initiated navigations to custom schemes.
      // User must tap the button to trigger the custom scheme (user gesture required).
      const url = 'com.ringcal.app://oauth?' + params
      setIntentUrl(url)
    } else {
      window.opener?.postMessage(window.location.href, window.location.origin)
      window.close()
    }
  }, [])

  if (error) return <div style={{ padding: 32, textAlign: 'center' }}>שגיאה — לא נמצא טוקן</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 24, padding: 32, textAlign: 'center' }}>
      <p style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>אישור התקבל!</p>
      <p style={{ margin: 0, color: '#555' }}>לחץ על הכפתור כדי לחזור לאפליקציה</p>
      {intentUrl && (
        <a
          href={intentUrl}
          style={{ padding: '16px 32px', background: '#4285f4', color: 'white', borderRadius: 16, textDecoration: 'none', fontSize: 20, fontWeight: 'bold', display: 'block' }}
        >
          פתח את RingCal
        </a>
      )}
    </div>
  )
}
