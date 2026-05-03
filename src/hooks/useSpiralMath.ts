/**
 * Core spiral math — extracted & cleaned from original index.html
 * All angles start at 12 o'clock (top) and go clockwise.
 */

/** Convert segment index i of n to radians (12 o'clock = start) */
export function ang(i: number, n: number): number {
  return -Math.PI / 2 + (i / n) * Math.PI * 2
}

/** Convert polar (angle, radius) to cartesian {x, y} */
export function pxy(a: number, r: number, cx: number, cy: number) {
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
}

/** Format a Date as a local YYYY-MM-DD string (avoids UTC offset bugs from toISOString) */
export function localISODate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Days in a given month */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** Day-of-week–aware date for day d in current month */
export function dateOfDay(d: number, year: number, month: number): Date {
  return new Date(year, month, d)
}

/** Hex color to rgb components */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** Build ring radii array from inner radius, outer radius and number of rings */
export function buildRings(rIn: number, rOut: number, nRings: number, focusedRing: number | null) {
  let widths: number[]
  if (focusedRing !== null && nRings > 1) {
    const fW = (rOut - rIn) * 0.55
    const rest = (rOut - rIn) * 0.45 / (nRings - 1)
    widths = Array.from({ length: nRings }, (_, i) => (i === focusedRing ? fW : rest))
  } else {
    const w = (rOut - rIn) / nRings
    widths = Array.from({ length: nRings }, () => w)
  }
  const rings = [rIn]
  widths.forEach((w) => rings.push(rings[rings.length - 1] + w))
  return rings // length = nRings + 1
}

/** Elapsed fraction of current period (0..1) */
export function elapsedFraction(mode: string, now: Date, year: number, month: number): number {
  if (mode === 'year') return 0
  if (mode === 'month') {
    const dim = daysInMonth(year, month)
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month
    if (!isCurrentMonth) return 0
    return (now.getDate() - 1 + (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400) / dim
  }
  if (mode === 'week') {
    return (now.getDay() + (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400) / 7
  }
  // day
  return (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400
}

/** Total segments for a mode */
export function segmentsForMode(mode: string, year: number, month: number): number {
  if (mode === 'month') return daysInMonth(year, month)
  if (mode === 'week') return 7
  if (mode === 'day') return 24
  return 12 // year
}

/** Critical time arc end angle */
export function criticalArcEnd(
  mode: string,
  critHours: number,
  critDays: number,
  now: Date,
  year: number,
  month: number
): number {
  if (mode === 'day') {
    const nowFrac = elapsedFraction('day', now, year, month)
    return ang(0, 1) + nowFrac * Math.PI * 2 + (critHours / 24) * Math.PI * 2
  }
  if (mode === 'week') {
    const nowFrac = elapsedFraction('week', now, year, month)
    return ang(0, 1) + nowFrac * Math.PI * 2 + (critDays / 7) * Math.PI * 2
  }
  if (mode === 'month') {
    const dim = daysInMonth(year, month)
    const nowFrac = elapsedFraction('month', now, year, month)
    return ang(0, 1) + nowFrac * Math.PI * 2 + (critDays / dim) * Math.PI * 2
  }
  return ang(0, 1)
}
