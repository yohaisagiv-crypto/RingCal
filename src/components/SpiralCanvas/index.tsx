import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useLang } from '../../hooks/useLang'
import { ang, pxy, hexToRgb, buildRings, elapsedFraction, segmentsForMode, daysInMonth, dateOfDay } from '../../hooks/useSpiralMath'
import type { CalendarEvent, Category } from '../../types'

interface Props {
  onTapEmpty: (date: Date) => void
  onTapEvent: (ev: CalendarEvent) => void
  eventsOverride?: CalendarEvent[]
}

export default function SpiralCanvas({ onTapEmpty, onTapEvent, eventsOverride }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { mode, needle, viewDate, events: storeEvents, categories, settings, setNeedle } = useAppStore()
  const events = eventsOverride ?? storeEvents
  const { tr } = useLang()
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // Drag state
  const isDragging = useRef(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  // Track all active pointers (to suppress needle rotation during multi-touch)
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const wasPinching = useRef(false)

  const draw = useCallback(() => {
    const now = new Date()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const CX = W / 2
    const CY = H / 2
    const S = W / 570

    const R_IN = 75 * S
    const R_OUT = 284 * S
    const OUTER_W = 14 * S
    const R_CAT_OUT = R_OUT - OUTER_W

    const nRings = Math.max(1, categories.filter(c => !c.hidden).length)
    const ringRadii = buildRings(R_IN, R_CAT_OUT, nRings, null)

    const T = segmentsForMode(mode, year, month)

    const donut = (ra: number, rb: number, col: string) => {
      ctx.save()
      ctx.beginPath()
      ctx.arc(CX, CY, rb, 0, Math.PI * 2)
      ctx.arc(CX, CY, ra, 0, Math.PI * 2, true)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.fill()
      ctx.restore()
    }

    const ringLine = (r: number, col: string, lw: number) => {
      ctx.beginPath()
      ctx.arc(CX, CY, r, 0, Math.PI * 2)
      ctx.strokeStyle = col
      ctx.lineWidth = lw
      ctx.stroke()
    }

    // ── Clear ──
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#f8f8fc'
    ctx.fillRect(0, 0, W, H)

    ctx.save()

    // ── Glow ──
    const glow = ctx.createRadialGradient(CX, CY, R_OUT * 0.7, CX, CY, R_OUT * 1.1)
    glow.addColorStop(0, 'rgba(66,133,244,.06)')
    glow.addColorStop(1, 'rgba(66,133,244,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(CX, CY, R_OUT * 1.1, 0, Math.PI * 2)
    ctx.fill()

    // ── Category ring fills ──
    const visibleCats = categories.filter(c => !c.hidden).sort((a, b) => a.ring - b.ring)
    visibleCats.forEach((cat, i) => {
      const ra = ringRadii[i]
      const rb = ringRadii[i + 1]
      const [r, g, b] = hexToRgb(cat.color)
      donut(ra, rb, `rgba(${r},${g},${b},.30)`)
      ctx.save()
      ctx.beginPath()
      ctx.arc(CX, CY, rb, 0, Math.PI * 2)
      ctx.arc(CX, CY, ra, 0, Math.PI * 2, true)
      ctx.closePath()
      ctx.clip()
      ctx.strokeStyle = `rgba(${r},${g},${b},.07)`
      ctx.lineWidth = 1
      for (let x = CX - R_OUT; x < CX + R_OUT; x += 8) {
        ctx.beginPath(); ctx.moveTo(x, CY - R_OUT); ctx.lineTo(x + R_OUT * 0.3, CY + R_OUT); ctx.stroke()
      }
      ctx.restore()
    })

    // ── Elapsed arc ──
    const df = elapsedFraction(mode, now, year, month)
    if (df > 0 && mode !== 'year') {
      const eA = -Math.PI / 2
      const eB = eA + df * Math.PI * 2
      visibleCats.forEach((cat, i) => {
        const ra = ringRadii[i]
        const rb = ringRadii[i + 1]
        const [r, g, b] = hexToRgb(cat.color)
        ctx.save()
        ctx.beginPath()
        ctx.arc(CX, CY, rb, eA, eB)
        ctx.arc(CX, CY, ra, eB, eA, true)
        ctx.closePath()
        ctx.fillStyle = `rgba(${r},${g},${b},.18)`
        ctx.fill()
        ctx.restore()
      })
    }

    // ── Spokes ──
    drawSpokes(ctx, mode, T, CX, CY, R_IN, R_OUT, R_CAT_OUT, S, year, month)

    // ── Ring outlines ──
    visibleCats.forEach((cat, i) => {
      ringLine(ringRadii[i + 1], cat.color + '88', 1)
    })
    ringLine(R_IN, 'rgba(0,0,60,.2)', 1.5)
    ringLine(R_CAT_OUT, 'rgba(0,0,80,.6)', 2)
    ringLine(R_OUT, 'rgba(0,0,80,.6)', 2)

    donut(R_CAT_OUT, R_OUT, 'rgba(220,228,248,.4)')

    // ── Weekend shading in outer ring ──
    drawWeekendShading(ctx, mode, T, CX, CY, R_CAT_OUT, R_OUT, year, month)

    // ── Date labels (outer ring) ──
    drawDateLabels(ctx, mode, T, CX, CY, R_CAT_OUT, R_OUT, S, year, month, tr.daysShort as unknown as string[], tr.months as unknown as string[])

    // ── Events ──
    drawEvents(ctx, mode, events, visibleCats, ringRadii, CX, CY, S, year, month, 1, viewDate)

    // ── Critical arc — only when now is within the viewed period ──
    const nowInPeriod = (() => {
      if (mode === 'day')   return now.toDateString() === viewDate.toDateString()
      if (mode === 'week') {
        const wStart = new Date(viewDate); wStart.setDate(viewDate.getDate() - viewDate.getDay()); wStart.setHours(0,0,0,0)
        const wEnd   = new Date(wStart);   wEnd.setDate(wStart.getDate() + 7)
        return now >= wStart && now < wEnd
      }
      if (mode === 'month') return now.getFullYear() === year && now.getMonth() === month
      return now.getFullYear() === year
    })()
    if (nowInPeriod) drawCriticalArc(ctx, mode, CX, CY, R_IN, R_CAT_OUT, settings.criticalTime, now, year, month, S)

    // ── Needle ──
    drawNeedle(ctx, mode, needle, CX, CY, R_IN, R_OUT, S, year, month)

    // ── Center clock ──
    drawClock(ctx, CX, CY, R_IN * 0.88, now, S)

    ctx.restore() // end zoom transform

  }, [mode, needle, viewDate, events, categories, settings, tr])

  // Resize + draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const wrap = canvas.parentElement!
    const resize = () => {
      const size = Math.min(wrap.offsetWidth, wrap.offsetHeight) - 8
      canvas.width = size
      canvas.height = size
      canvas.style.width = size + 'px'
      canvas.style.height = size + 'px'
      draw()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()
    return () => ro.disconnect()
  }, [draw])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const id = setInterval(draw, 1000)
    return () => clearInterval(id)
  }, [draw])

  // ── Pointer helpers ──
  const canvasToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scale = canvas.width / rect.width
    // screen → canvas pixel coordinates (no transform to undo)
    const x = (clientX - rect.left) * scale
    const y = (clientY - rect.top) * scale
    const CX = canvas.width / 2
    const CY = canvas.height / 2
    return { x, y, CX, CY, S: canvas.width / 570 }
  }, [])

  const getAngleFromPointer = useCallback((clientX: number, clientY: number): number | null => {
    const w = canvasToWorld(clientX, clientY)
    if (!w) return null
    const { x, y, CX, CY, S } = w
    const dx = x - CX, dy = y - CY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 75 * S * 0.4 || dist > 278 * S * 1.05) return null
    let a = Math.atan2(dy, dx) + Math.PI / 2
    if (a < 0) a += Math.PI * 2
    return a / (Math.PI * 2)
  }, [canvasToWorld])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activePointers.current.size === 1) {
      dragStart.current = { x: e.clientX, y: e.clientY }
      isDragging.current = false
    } else if (activePointers.current.size >= 2) {
      // Multi-touch: cancel single-finger drag
      wasPinching.current = true
      isDragging.current = false
      dragStart.current = null
    }
    ;(e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Multi-touch: do nothing (prevents erratic needle movement with 2+ fingers)
    if (activePointers.current.size >= 2) return

    if (!dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    if (!isDragging.current && Math.sqrt(dx * dx + dy * dy) > 6) {
      isDragging.current = true
    }
    if (isDragging.current) {
      const frac = getAngleFromPointer(e.clientX, e.clientY)
      if (frac !== null) setNeedle(fracToDate(frac, mode, viewDate))
      dragStart.current = { x: e.clientX, y: e.clientY }
    }
  }, [mode, viewDate, getAngleFromPointer, setNeedle])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging.current && !wasPinching.current) {
      const w = canvasToWorld(e.clientX, e.clientY)
      if (!w) { activePointers.current.delete(e.pointerId); return }
      const { x, y, CX, CY, S } = w
      const R_OUT = 278 * S, R_IN = 75 * S
      const dx = x - CX, dy = y - CY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist >= R_IN && dist <= R_OUT) {
        let a = Math.atan2(dy, dx) + Math.PI / 2
        if (a < 0) a += Math.PI * 2
        const frac = a / (Math.PI * 2)
        const tapDate = fracToDate(frac, mode, viewDate)

        // Compute current needle fraction to detect second-tap
        const dim = daysInMonth(year, month)
        const nMin = needle.getHours() * 60 + needle.getMinutes()
        let needleFrac = 0
        if (mode === 'day') needleFrac = nMin / 1440
        else if (mode === 'week') needleFrac = (needle.getDay() + nMin / 1440) / 7
        else if (mode === 'month') needleFrac = (needle.getDate() - 1 + nMin / 1440) / dim
        else {
          const jan1 = new Date(needle.getFullYear(), 0, 1).getTime()
          needleFrac = (needle.getTime() - jan1) / (new Date(needle.getFullYear() + 1, 0, 1).getTime() - jan1)
        }

        const needleDiff = Math.min(Math.abs(frac - needleFrac), 1 - Math.abs(frac - needleFrac))
        const isOnNeedle = needleDiff < 0.03

        // Tap directly on event dot → open event
        const tappedEv = hitTestEvent(x, y, mode, events, categories, CX, CY, S, CX * 2, year, month, viewDate)
        if (tappedEv) {
          onTapEvent(tappedEv)
        } else if (isOnNeedle) {
          // Double-tap on needle → open add form at that date
          onTapEmpty(tapDate)
        } else {
          // Regular tap → move needle only
          setNeedle(tapDate)
        }
      }
    }
    activePointers.current.delete(e.pointerId)
    if (activePointers.current.size === 0) wasPinching.current = false
    isDragging.current = false
    dragStart.current = null
  }, [mode, viewDate, needle, events, categories, year, month, onTapEvent, onTapEmpty, setNeedle, canvasToWorld])

  return (
    <div
      className="flex-1 overflow-hidden bg-[#f5f5f7]"
      style={{ position: 'relative' }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          display: 'block',
          position: 'absolute',
          top: 0, bottom: 0, left: 0, right: 0,
          margin: 'auto',
          touchAction: 'none',
          cursor: 'pointer',
        }}
      />
    </div>
  )
}

// ── Drawing helpers ──────────────────────────────────────────────────────────

function drawSpokes(
  ctx: CanvasRenderingContext2D,
  mode: string, _T: number,
  CX: number, CY: number,
  R_IN: number, R_OUT: number, R_CAT_OUT: number,
  S: number, year: number, month: number
) {
  if (mode === 'year') {
    for (let m = 0; m < 12; m++) {
      const a = ang(m, 12)
      const p1 = pxy(a, R_IN, CX, CY)
      const p2 = pxy(a, R_OUT, CX, CY)
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y)
      ctx.strokeStyle = 'rgba(0,0,20,.5)'; ctx.lineWidth = 2; ctx.stroke()

      const dim = daysInMonth(year, m)
      const ss = ang(m, 12); const sp = ang(m + 1, 12) - ss
      for (let d = 1; d < dim; d++) {
        const da = ss + (d / dim) * sp
        const dow = new Date(year, m, d + 1).getDay()
        const isSat = dow === 6; const isSun = dow === 0
        const isMaj = d % 7 === 0
        const tickOut = (isSat || isSun) ? R_CAT_OUT : R_IN
        const tickLen = (isSat || isSun) ? 18 : isMaj ? 13 : 8
        const tickIn = tickOut - tickLen * S
        const p1 = pxy(da, tickIn, CX, CY); const p2 = pxy(da, tickOut, CX, CY)
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y)
        ctx.strokeStyle = (isSat || isSun) ? 'rgba(200,50,50,.65)' : isMaj ? 'rgba(0,0,60,.55)' : 'rgba(0,0,40,.2)'
        ctx.lineWidth = (isSat || isSun) ? 1.4 : isMaj ? 1.1 : 0.5; ctx.stroke()
      }
    }
  } else if (mode === 'week') {
    for (let i = 0; i < 7; i++) {
      const a = ang(i, 7)
      const p1 = pxy(a, R_IN, CX, CY); const p2 = pxy(a, R_OUT, CX, CY)
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y)
      ctx.strokeStyle = i % 7 === 0 || i % 7 === 6 ? 'rgba(0,0,50,.55)' : 'rgba(0,0,50,.22)'
      ctx.lineWidth = i % 7 === 0 ? 2.5 : 0.7; ctx.stroke()
    }
  } else if (mode === 'month') {
    const dim = daysInMonth(year, month)
    for (let d = 0; d < dim; d++) {
      const da = ang(d, dim)
      const dow = new Date(year, month, d + 1).getDay()
      const isWeekDiv = d > 0 && dow === 0
      const isFriSat = dow === 5 || dow === 6
      // Inner ring: spoke for every day
      const p1 = pxy(da, R_IN, CX, CY); const p2 = pxy(da, R_CAT_OUT, CX, CY)
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y)
      ctx.strokeStyle = isWeekDiv ? 'rgba(0,0,0,.75)' : 'rgba(0,0,40,.18)'
      ctx.lineWidth = isWeekDiv ? 2.5 : 0.6; ctx.lineCap = 'round'; ctx.stroke()
      // Outer ring: all days get a thin line; week dividers and Fri/Sat are more prominent
      const p3 = pxy(da, R_CAT_OUT, CX, CY); const p4 = pxy(da, R_OUT, CX, CY)
      ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y)
      ctx.strokeStyle = isWeekDiv ? 'rgba(0,0,0,.65)' : isFriSat ? 'rgba(0,0,40,.35)' : d === 0 ? 'rgba(0,0,0,.65)' : 'rgba(0,0,40,.18)'
      ctx.lineWidth = isWeekDiv ? 2 : isFriSat ? 0.9 : d === 0 ? 2 : 0.5; ctx.lineCap = 'round'; ctx.stroke()
    }
  } else if (mode === 'day') {
    for (let h = 0; h < 24; h++) {
      const da = ang(h, 24)
      const isMaj = h % 6 === 0; const isMid = h % 3 === 0
      const p1 = pxy(da, R_IN, CX, CY); const p2 = pxy(da, R_OUT, CX, CY)
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y)
      ctx.strokeStyle = isMaj ? 'rgba(0,0,60,.65)' : isMid ? 'rgba(0,0,60,.4)' : 'rgba(0,0,40,.22)'
      ctx.lineWidth = isMaj ? 2.5 : isMid ? 1.5 : 0.7; ctx.lineCap = 'round'; ctx.stroke()
    }
  }
}

function drawWeekendShading(
  ctx: CanvasRenderingContext2D, mode: string, _T: number,
  CX: number, CY: number, R_IN: number, R_OUT: number, year: number, month: number
) {
  const shade = (a1: number, a2: number, isSat: boolean) => {
    ctx.save()
    ctx.beginPath()
    ctx.arc(CX, CY, R_OUT, a1, a2)
    ctx.arc(CX, CY, R_IN, a2, a1, true)
    ctx.closePath()
    ctx.fillStyle = isSat ? 'rgba(100,100,110,.35)' : 'rgba(0,180,180,.25)'
    ctx.fill()
    ctx.restore()
  }

  if (mode === 'week') {
    for (let i = 0; i < 7; i++) {
      if (i === 5 || i === 6) shade(ang(i, 7), ang(i + 1, 7), i === 6)
    }
  } else if (mode === 'month') {
    const dim = daysInMonth(year, month)
    for (let d = 1; d <= dim; d++) {
      const dow = dateOfDay(d, year, month).getDay()
      if (dow === 5 || dow === 6) shade(ang(d - 1, dim), ang(d, dim), dow === 6)
    }
  } else if (mode === 'year') {
    for (let m = 0; m < 12; m++) {
      const di = daysInMonth(year, m)
      const ss = ang(m, 12); const sp = ang(m + 1, 12) - ss
      for (let d = 1; d <= di; d++) {
        const dow = new Date(year, m, d).getDay()
        if (dow === 5 || dow === 6) {
          const a1 = ss + ((d - 1) / di) * sp; const a2 = ss + (d / di) * sp
          shade(a1, a2, dow === 6)
        }
      }
    }
  }
}

function drawDateLabels(
  ctx: CanvasRenderingContext2D, mode: string, _T: number,
  CX: number, CY: number, R_IN: number, R_OUT: number, S: number, year: number, month: number,
  daysShort: string[], monthNames: string[]
) {
  const mid = (R_IN + R_OUT) / 2

  if (mode === 'day') {
    for (let h = 0; h < 24; h++) {
      if (h % 3 !== 0) continue
      const a = ang(h + 0.5, 24)
      const p = pxy(a, mid, CX, CY)
      ctx.save()
      ctx.translate(p.x, p.y); ctx.rotate(a + Math.PI / 2)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = `900 ${Math.max(9, Math.round(11 * S))}px 'Space Mono'`
      ctx.fillStyle = 'rgba(0,0,60,.8)'
      ctx.fillText(String(h).padStart(2, '0'), 0, 0)
      ctx.restore()
    }
  } else if (mode === 'week') {
    for (let i = 0; i < 7; i++) {
      const a = ang(i + 0.5, 7)
      const p = pxy(a, mid, CX, CY)
      ctx.save()
      ctx.translate(p.x, p.y); ctx.rotate(a + Math.PI / 2)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = `900 ${Math.max(11, Math.round(13 * S))}px 'Heebo'`
      ctx.fillStyle = 'rgba(0,0,60,.85)'
      ctx.fillText(daysShort[i] ?? '', 0, 0)
      ctx.restore()
    }
  } else if (mode === 'month') {
    const dim = daysInMonth(year, month)
    for (let d = 1; d <= dim; d++) {
      const a = ang(d - 0.5, dim)
      const p = pxy(a, mid, CX, CY)
      ctx.save()
      ctx.translate(p.x, p.y); ctx.rotate(a + Math.PI / 2)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = `900 ${Math.max(8, Math.round(10 * S))}px 'Space Mono'`
      ctx.fillStyle = 'rgba(0,0,60,.8)'
      ctx.fillText(String(d), 0, 0)
      ctx.restore()
    }
  } else if (mode === 'year') {
    for (let m = 0; m < 12; m++) {
      const a = ang(m + 0.5, 12)
      const p = pxy(a, mid, CX, CY)
      ctx.save()
      ctx.translate(p.x, p.y); ctx.rotate(a + Math.PI / 2)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = `900 ${Math.max(10, Math.round(13 * S))}px 'Heebo'`
      ctx.fillStyle = 'rgba(0,0,60,.9)'
      ctx.fillText(monthNames[m] ?? '', 0, 0)
      ctx.restore()
    }
  }
}

function drawEvents(
  ctx: CanvasRenderingContext2D,
  mode: string,
  events: CalendarEvent[],
  visibleCats: Category[],
  ringRadii: number[],
  CX: number, CY: number, S: number, year: number, month: number,
  zoom = 1,
  viewDate = new Date()
) {
  const getAngle = (ev: CalendarEvent): { a1: number; a2: number } | null => {
    const startDate = new Date(ev.date + 'T00:00:00')
    // Compute effective end date from endDate field or durationDays
    let endDate: Date | null = null
    if (ev.endDate) {
      endDate = new Date(ev.endDate + 'T00:00:00')
    } else if ((ev.durationDays ?? 0) > 1) {
      endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + (ev.durationDays ?? 1) - 1)
    }

    if (mode === 'year') {
      // Check if event overlaps this year
      const yearStart = new Date(year, 0, 1)
      const yearEnd = new Date(year + 1, 0, 1)
      if (startDate >= yearEnd) return null
      if (endDate && endDate < yearStart) return null
      if (!endDate && startDate.getFullYear() !== year) return null

      // Clamp start to this year
      const clampedStart = startDate < yearStart ? yearStart : startDate
      // Clamp end to this year
      const clampedEnd = endDate ? (endDate >= yearEnd ? new Date(year, 11, 31) : endDate) : clampedStart

      const toYearFrac = (d: Date) => {
        const m = d.getMonth(); const dim = daysInMonth(year, m); const day = d.getDate()
        const ss = ang(m, 12); const sp = ang(m + 1, 12) - ss
        return ss + ((day - 1) / dim) * sp
      }
      return { a1: toYearFrac(clampedStart), a2: toYearFrac(clampedEnd) + ang(1, 12) / daysInMonth(year, clampedEnd.getMonth()) }
    }
    if (mode === 'month') {
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 1)
      if (startDate >= monthEnd) return null
      if (endDate && endDate < monthStart) return null
      if (!endDate && (startDate.getFullYear() !== year || startDate.getMonth() !== month)) return null

      const dim = daysInMonth(year, month)
      const clampedStart = startDate < monthStart ? 1 : startDate.getDate()
      const clampedEnd = endDate
        ? (endDate >= monthEnd ? dim : endDate.getDate())
        : clampedStart
      return { a1: ang(clampedStart - 1, dim), a2: ang(clampedEnd, dim) }
    }
    if (mode === 'week') {
      const weekStart = getWeekStart(viewDate)
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7)
      if (startDate >= weekEnd) return null
      if (endDate && endDate < weekStart) return null
      const startDiff = Math.floor((startDate.getTime() - weekStart.getTime() + 43200000) / 86400000)
      if (!endDate && (startDiff < 0 || startDiff >= 7)) return null

      const clampedStart = Math.max(0, startDiff)
      const endDiff = endDate
        ? Math.floor((endDate.getTime() - weekStart.getTime() + 43200000) / 86400000)
        : startDiff
      const clampedEnd = Math.min(6, endDiff)
      return { a1: ang(clampedStart, 7), a2: ang(clampedEnd + 1, 7) }
    }
    if (mode === 'day') {
      const dayView = new Date(viewDate); dayView.setHours(0, 0, 0, 0)
      const evDay = new Date(ev.date + 'T00:00:00')
      if (evDay.toDateString() !== dayView.toDateString()) return null
      const [hh, mm] = (ev.time || '00:00').split(':').map(Number)
      const startMin = hh * 60 + mm
      let endMin = startMin + 30
      if (ev.endTime) {
        const [eh, em] = ev.endTime.split(':').map(Number)
        const candidate = eh * 60 + em
        if (candidate > startMin) endMin = candidate
      } else {
        const durH = (ev.durationHours ?? 0) + (ev.durationMinutes ?? 0) / 60
        if (durH > 0) endMin = startMin + durH * 60
      }
      return { a1: ang(startMin / 60, 24), a2: ang(endMin / 60, 24) }
    }
    return null
  }

  // Returns extended end angle for tasks with duration > one unit
  const getTaskEndAngle = (ev: CalendarEvent, _a1: number, a2: number): number => {
    if (mode === 'day') {
      if (ev.endTime) {
        const [eh, em] = ev.endTime.split(':').map(Number)
        return ang(eh + em / 60, 24)
      }
      const durH = (ev.durationHours ?? 0) + (ev.durationMinutes ?? 0) / 60
      if (durH > 0.9) {
        const [hh, mm] = (ev.time || '00:00').split(':').map(Number)
        return ang(Math.min(24, hh + mm / 60 + durH), 24)
      }
    }
    if (mode === 'week' && (ev.durationDays ?? 0) > 1) {
      const weekStart = getWeekStart(viewDate)
      const d = new Date(ev.date + 'T00:00:00')
      const diff = Math.floor((d.getTime() - weekStart.getTime() + 43200000) / 86400000)
      return ang(Math.min(7, diff + (ev.durationDays ?? 1)), 7)
    }
    if (mode === 'month' && (ev.durationDays ?? 0) > 1) {
      const d = new Date(ev.date + 'T00:00:00')
      if (d.getFullYear() !== year || d.getMonth() !== month) return a2
      const dim = daysInMonth(year, month)
      return ang(Math.min(dim, d.getDate() - 1 + (ev.durationDays ?? 1)), dim)
    }
    if (mode === 'year' && (ev.durationDays ?? 0) > 15) {
      const d = new Date(ev.date + 'T00:00:00')
      if (d.getFullYear() !== year) return a2
      const m = d.getMonth()
      const dim = daysInMonth(year, m)
      const ss = ang(m, 12); const sp = ang(m + 1, 12) - ss
      return ss + (Math.min(dim, d.getDate() - 1 + (ev.durationDays ?? 1)) / dim) * sp
    }
    return a2
  }

  events.forEach(ev => {
    if (ev.done) return
    const angles = getAngle(ev)
    if (!angles) return
    const { a1, a2 } = angles
    const catIdx = visibleCats.findIndex(c => c.id === ev.categoryId)
    if (catIdx < 0) return
    const ra = ringRadii[catIdx]
    const rb = ringRadii[catIdx + 1]
    const col = visibleCats[catIdx].color
    const [r, g, b] = hexToRgb(col)
    const rMid = (ra + rb) / 2

    if (ev.itemType === 'task') {
      // Thin arc line on ring midline — doesn't block other content
      const a2End = getTaskEndAngle(ev, a1, a2)
      const lineW = Math.max(2, (rb - ra) * 0.22)
      ctx.save()
      ctx.beginPath()
      ctx.arc(CX, CY, rMid, a1, a2End)
      ctx.strokeStyle = col
      ctx.lineWidth = lineW
      ctx.globalAlpha = 0.6
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.restore()
      // Diamond marker at start
      const p = pxy(a1, rMid, CX, CY)
      const cr = Math.max(4, Math.round(4.5 * S))
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(Math.PI / 4)
      ctx.beginPath()
      ctx.rect(-cr, -cr, cr * 2, cr * 2)
      ctx.fillStyle = col; ctx.globalAlpha = 1; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.globalAlpha = 1; ctx.stroke()
      ctx.restore()
    } else {
      const unitAngle = mode === 'day' ? Math.PI * 2 / 24
        : mode === 'week' ? Math.PI * 2 / 7
        : mode === 'month' ? Math.PI * 2 / daysInMonth(year, month)
        : Math.PI * 2 / 12
      // Outlined arc band: light category-color fill + solid border
      ctx.save()
      ctx.beginPath()
      ctx.arc(CX, CY, rb - 1, a1, a2)
      ctx.arc(CX, CY, ra + 1, a2, a1, true)
      ctx.closePath()
      ctx.fillStyle = `rgba(${r},${g},${b},0.18)`
      ctx.globalAlpha = 1
      ctx.fill()
      ctx.strokeStyle = col
      ctx.lineWidth = 1.8
      ctx.stroke()
      ctx.restore()
      // ★ near start of event
      const starSpan = a2 - a1
      const starA = a1 + Math.min(starSpan * 0.3, unitAngle * 0.45)
      const sp = pxy(starA, rMid, CX, CY)
      const fontSize = Math.max(8, Math.round(10 * S))
      ctx.save()
      ctx.translate(sp.x, sp.y)
      ctx.rotate(starA + Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `bold ${fontSize}px Arial`
      ctx.fillStyle = col
      ctx.globalAlpha = 1
      ctx.fillText('★', 0, 0)
      ctx.restore()
    }

    // Show label when zoomed in enough
    if (zoom >= 1.6) {
      const labelAngle = ev.itemType === 'task' ? a1 : (a1 + a2) / 2
      const labelR = rb + 10 * S
      const lp = pxy(labelAngle, labelR, CX, CY)
      const fontSize = Math.max(7, Math.round(7 * S))
      ctx.save()
      ctx.translate(lp.x, lp.y)
      ctx.rotate(labelAngle + Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // Background pill
      const typeIcon = ev.itemType === 'task' ? '✅' : '📅'
      const rawTitle = ev.title.length > 12 ? ev.title.slice(0, 11) + '…' : ev.title
      const label = `${typeIcon} ${rawTitle}`
      const dateLabel = ev.time ? ev.time.slice(0, 5) : ev.date.slice(5)
      ctx.font = `700 ${fontSize}px 'Heebo'`
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.beginPath()
      ctx.roundRect(-(tw / 2 + 3), -fontSize * 0.7, tw + 6, fontSize * 1.4, 3)
      ctx.fill()
      ctx.fillStyle = col
      ctx.fillText(label, 0, 0)
      // Date sub-label
      ctx.font = `400 ${Math.max(5, fontSize - 2)}px 'Space Mono'`
      ctx.fillStyle = 'rgba(0,0,60,.55)'
      ctx.fillText(dateLabel, 0, fontSize * 1.1)
      ctx.restore()
    }
  })
}

function drawCriticalArc(
  ctx: CanvasRenderingContext2D,
  mode: string,
  CX: number, CY: number,
  R_IN: number, R_CAT_OUT: number,
  crit: { day: number; week: number; month: number; year: number },
  now: Date, year: number, month: number, S: number
) {
  let nowFrac: number
  let critFrac: number
  if (mode === 'day') {
    nowFrac = (now.getHours() * 60 + now.getMinutes()) / 1440
    critFrac = crit.day / 24
  } else if (mode === 'week') {
    nowFrac = (now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes()) / (7 * 1440)
    critFrac = crit.week / 7
  } else if (mode === 'month') {
    const dim = daysInMonth(year, month)
    nowFrac = (now.getDate() - 1 + (now.getHours() * 60 + now.getMinutes()) / 1440) / dim
    critFrac = crit.month / dim
  } else {
    // year mode: crit.year is in months (default 2)
    const jan1 = new Date(year, 0, 1).getTime()
    const yearMs = new Date(year + 1, 0, 1).getTime() - jan1
    nowFrac = Math.min(1, Math.max(0, (now.getTime() - jan1) / yearMs))
    critFrac = ((crit.year ?? 2) * 30.5 * 24 * 3600000) / yearMs
  }

  const startA = -Math.PI / 2 + nowFrac * Math.PI * 2
  const endA = startA + critFrac * Math.PI * 2

  ctx.save()
  // Fill
  ctx.beginPath()
  ctx.arc(CX, CY, R_CAT_OUT, startA, endA)
  ctx.arc(CX, CY, R_IN, endA, startA, true)
  ctx.closePath()
  ctx.fillStyle = 'rgba(231,76,60,.32)'
  ctx.fill()
  // Outer border
  ctx.beginPath()
  ctx.arc(CX, CY, R_CAT_OUT, startA, endA)
  ctx.strokeStyle = 'rgba(231,76,60,.95)'
  ctx.lineWidth = 3 * S
  ctx.stroke()
  // Inner border
  ctx.beginPath()
  ctx.arc(CX, CY, R_IN, startA, endA)
  ctx.strokeStyle = 'rgba(231,76,60,.7)'
  ctx.lineWidth = 2 * S
  ctx.stroke()
  // Side lines (start and end of arc)
  const pOutStart = pxy(startA, R_CAT_OUT, CX, CY)
  const pInStart  = pxy(startA, R_IN, CX, CY)
  const pOutEnd   = pxy(endA,   R_CAT_OUT, CX, CY)
  const pInEnd    = pxy(endA,   R_IN, CX, CY)
  ctx.strokeStyle = 'rgba(231,76,60,.6)'
  ctx.lineWidth = 1.5 * S
  ctx.beginPath(); ctx.moveTo(pInStart.x, pInStart.y); ctx.lineTo(pOutStart.x, pOutStart.y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(pInEnd.x,   pInEnd.y);   ctx.lineTo(pOutEnd.x,   pOutEnd.y);   ctx.stroke()
  ctx.restore()
}

function drawNeedle(
  ctx: CanvasRenderingContext2D,
  mode: string,
  needle: Date,
  CX: number, CY: number,
  R_IN: number, R_OUT: number, S: number, year: number, month: number
) {
  let frac = 0
  const minOfDay = needle.getHours() * 60 + needle.getMinutes()
  if (mode === 'day') {
    frac = minOfDay / 1440
  } else if (mode === 'week') {
    frac = (needle.getDay() + minOfDay / 1440) / 7
  } else if (mode === 'month') {
    const dim = daysInMonth(year, month)
    frac = (needle.getDate() - 1 + minOfDay / 1440) / dim
  } else {
    const jan1 = new Date(needle.getFullYear(), 0, 1).getTime()
    const jan1Next = new Date(needle.getFullYear() + 1, 0, 1).getTime()
    frac = (needle.getTime() - jan1) / (jan1Next - jan1)
  }

  const a = -Math.PI / 2 + frac * Math.PI * 2
  const pTip = pxy(a, R_OUT + 2, CX, CY)
  const pBase = pxy(a, R_IN * 0.5, CX, CY)

  ctx.save()
  ctx.beginPath(); ctx.moveTo(pBase.x, pBase.y); ctx.lineTo(pTip.x, pTip.y)
  ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke()
  ctx.beginPath(); ctx.arc(pTip.x, pTip.y, 5 * S, 0, Math.PI * 2)
  ctx.fillStyle = '#e74c3c'; ctx.fill()
  ctx.restore()
}

function drawClock(
  ctx: CanvasRenderingContext2D,
  CX: number, CY: number, R: number, now: Date, S: number
) {
  // White face
  ctx.save()
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'; ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,60,.2)'; ctx.lineWidth = 1; ctx.stroke()

  // Hour tick marks
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI * 2
    const isMaj = i % 3 === 0
    const tickOuter = R * 0.9
    const tickLen = isMaj ? R * 0.18 : R * 0.1
    const p1 = pxy(a, tickOuter, CX, CY)
    const p2 = pxy(a, tickOuter - tickLen, CX, CY)
    ctx.save()
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y)
    ctx.strokeStyle = isMaj ? 'rgba(0,0,60,.7)' : 'rgba(0,0,60,.35)'
    ctx.lineWidth = (isMaj ? 1.8 : 0.9) * S
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.restore()

    // Numbers: 12, 3, 6, 9
    if (isMaj) {
      const labels = ['12', '3', '6', '9']
      const p = pxy(a, R * 0.62, CX, CY)
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = `900 ${Math.max(9, Math.round(11 * S))}px 'Space Mono'`
      ctx.fillStyle = 'rgba(0,0,60,.75)'
      ctx.fillText(labels[i / 3], p.x, p.y)
      ctx.restore()
    }
  }

  const h = now.getHours() % 12
  const m = now.getMinutes()
  const sec = now.getSeconds()

  const hand = (frac: number, len: number, col: string, lw: number) => {
    const a = -Math.PI / 2 + frac * Math.PI * 2
    const tip = pxy(a, len, CX, CY)
    ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(tip.x, tip.y)
    ctx.strokeStyle = col; ctx.lineWidth = lw * S; ctx.lineCap = 'round'; ctx.stroke()
  }

  hand((h + m / 60) / 12, R * 0.55, '#1a1a2e', 2.5)
  hand((m + sec / 60) / 60, R * 0.75, '#1a1a2e', 1.8)
  hand(sec / 60, R * 0.82, '#e74c3c', 1.2)

  // Center dot
  ctx.beginPath(); ctx.arc(CX, CY, 3 * S, 0, Math.PI * 2)
  ctx.fillStyle = '#e74c3c'; ctx.fill()

  // Date badge
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.max(7, Math.round(8 * S))}px 'Space Mono'`
  ctx.fillStyle = '#fff'
  ctx.fillRect(CX - 12 * S, CY + R * 0.3, 24 * S, 12 * S)
  ctx.fillStyle = '#e74c3c'
  ctx.fillText(String(now.getDate()), CX, CY + R * 0.36)

  ctx.restore()
}

// ── Utilities ────────────────────────────────────────────────────────────────

function getWeekStart(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() - s.getDay())
  return s
}

function fracToDate(frac: number, mode: string, viewDate: Date): Date {
  const f = Math.max(0, Math.min(1, frac))
  if (mode === 'year') {
    const start = new Date(viewDate.getFullYear(), 0, 1).getTime()
    const end = new Date(viewDate.getFullYear() + 1, 0, 1).getTime()
    return new Date(start + f * (end - start))
  }
  if (mode === 'month') {
    const dim = daysInMonth(viewDate.getFullYear(), viewDate.getMonth())
    const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
    return new Date(start.getTime() + Math.round(f * dim * 24 * 60) * 60000)
  }
  if (mode === 'week') {
    const ws = getWeekStart(viewDate)
    return new Date(ws.getTime() + Math.round(f * 7 * 24 * 60) * 60000)
  }
  // day
  const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate())
  return new Date(start.getTime() + Math.round(f * 24 * 60) * 60000)
}

function getEventFrac(ev: CalendarEvent, mode: string, year: number, month: number, viewDate: Date): number | null {
  const d = new Date(ev.date + 'T00:00:00')
  if (mode === 'day') {
    const dayView = new Date(viewDate); dayView.setHours(0, 0, 0, 0)
    if (d.toDateString() !== dayView.toDateString()) return null
    const [hh, mm] = (ev.time || '00:00').split(':').map(Number)
    return (hh * 60 + mm) / 1440
  }
  if (mode === 'week') {
    const ws = getWeekStart(viewDate)
    // +43200000 (12h) guards against DST-transition days that are only 23h long
    const diff = Math.floor((d.getTime() - ws.getTime() + 43200000) / 86400000)
    if (diff < 0 || diff >= 7) return null
    return diff / 7
  }
  if (mode === 'month') {
    if (d.getFullYear() !== year || d.getMonth() !== month) return null
    return (d.getDate() - 1) / daysInMonth(year, month)
  }
  // year
  if (d.getFullYear() !== year) return null
  return d.getMonth() / 12
}

function hitTestEvent(
  x: number, y: number, mode: string,
  events: CalendarEvent[], visibleCats: Category[],
  CX: number, CY: number, S: number, _canvasW: number,
  year: number, month: number, viewDate: Date
): CalendarEvent | null {
  const R_IN = 75 * S; const R_OUT = 278 * S
  const R_CAT_OUT = R_OUT - 14 * S
  const nRings = visibleCats.length
  const rings = buildRings(R_IN, R_CAT_OUT, nRings, null)
  const dx = x - CX; const dy = y - CY
  const dist = Math.sqrt(dx * dx + dy * dy)
  let a = Math.atan2(dy, dx) + Math.PI / 2
  if (a < 0) a += Math.PI * 2
  const frac = a / (Math.PI * 2)

  // First pass: strict ring + angle check
  for (const ev of events) {
    const catIdx = visibleCats.findIndex(c => c.id === ev.categoryId)
    if (catIdx < 0) continue
    const ra = rings[catIdx]; const rb = rings[catIdx + 1]
    if (dist < ra || dist > rb) continue
    const evFrac = getEventFrac(ev, mode, year, month, viewDate)
    if (evFrac === null) continue
    const diff = Math.min(Math.abs(frac - evFrac), 1 - Math.abs(frac - evFrac))
    if (diff < 0.06) return ev
  }

  // Second pass: angle-only (covers tapping near needle tip / R_OUT area)
  for (const ev of events) {
    const catIdx = visibleCats.findIndex(c => c.id === ev.categoryId)
    if (catIdx < 0) continue
    const evFrac = getEventFrac(ev, mode, year, month, viewDate)
    if (evFrac === null) continue
    const diff = Math.min(Math.abs(frac - evFrac), 1 - Math.abs(frac - evFrac))
    if (diff < 0.04) return ev
  }
  return null
}
