import { getToken, clearAuth } from './googleCalendar'

const DRIVE_API  = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FILE_NAME  = 'ringcal-sync.json'
const SYNC_TS_KEY = 'ringcal_drive_ts'

async function driveFetch(path: string, init: RequestInit = {}, upload = false): Promise<unknown> {
  const token = getToken()
  if (!token) throw new Error('not_connected')
  const base = upload ? UPLOAD_API : DRIVE_API
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  })
  if (res.status === 401) { clearAuth(); throw new Error('token_expired') }
  if (res.status === 403) throw new Error('no_drive_scope')
  if (res.status === 204) return null
  try { return await res.json() } catch { return null }
}

async function findFileId(): Promise<string | null> {
  const data = await driveFetch(
    `/files?spaces=appDataFolder&q=name%3D'${FILE_NAME}'&fields=files(id)&pageSize=1`
  ) as { files?: { id: string }[] } | null
  return data?.files?.[0]?.id ?? null
}

export async function pullFromDrive(): Promise<{
  events?: unknown[]; categories?: unknown[]; settings?: unknown; lastSync?: string
} | null> {
  try {
    const fileId = await findFileId()
    if (!fileId) return null
    const token = getToken()
    if (!token) return null
    const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export async function pushToDrive(payload: object): Promise<void> {
  try {
    const token = getToken()
    if (!token) return
    const ts = new Date().toISOString()
    const json = JSON.stringify({ ...payload, lastSync: ts })
    const fileId = await findFileId()
    const boundary = 'rcal_b'
    const meta = JSON.stringify(fileId ? {} : { name: FILE_NAME, parents: ['appDataFolder'] })
    const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`
    const url = fileId ? `/files/${fileId}?uploadType=multipart` : `/files?uploadType=multipart`
    const method = fileId ? 'PATCH' : 'POST'
    await fetch(`${UPLOAD_API}${url}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    })
    localStorage.setItem(SYNC_TS_KEY, ts)
  } catch { /* silent */ }
}

export function getLocalSyncTs(): string | null {
  return localStorage.getItem(SYNC_TS_KEY)
}

export function isDriveAvailable(): boolean {
  return !!getToken()
}
