import { useRef, useEffect } from 'react'

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (val: string) => void
}

export function NativeInput({ value, onChange, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let last = el.value

    const read = () => {
      const v = el.value
      if (v !== last) { last = v; onChangeRef.current(v) }
    }

    // Standard input event
    el.addEventListener('input', read)

    // selectionchange fires when cursor moves (after IME backspace) — more reliable on Android
    const onSelChange = () => { if (document.activeElement === el) read() }
    document.addEventListener('selectionchange', onSelChange)

    // keyup catches hardware backspace key events
    el.addEventListener('keyup', read)

    // Fallback poll at 30ms — catches anything missed by events
    const poll = setInterval(() => {
      if (document.activeElement === el) read()
    }, 30)

    return () => {
      el.removeEventListener('input', read)
      el.removeEventListener('keyup', read)
      document.removeEventListener('selectionchange', onSelChange)
      clearInterval(poll)
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    if (el.value !== value) {
      const s = el.selectionStart; const e2 = el.selectionEnd
      el.value = value
      try { el.setSelectionRange(s, e2) } catch { /* type may not support selection */ }
    }
  })

  return <input ref={ref} defaultValue={value} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} {...props} />
}

interface TAProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string
  onChange: (val: string) => void
}

export function NativeTextarea({ value, onChange, ...props }: TAProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let last = el.value
    const read = () => {
      const v = el.value
      if (v !== last) { last = v; onChangeRef.current(v) }
    }
    el.addEventListener('input', read)
    el.addEventListener('keyup', read)
    const onSelChange = () => { if (document.activeElement === el) read() }
    document.addEventListener('selectionchange', onSelChange)
    const poll = setInterval(() => { if (document.activeElement === el) read() }, 30)
    return () => {
      el.removeEventListener('input', read)
      el.removeEventListener('keyup', read)
      document.removeEventListener('selectionchange', onSelChange)
      clearInterval(poll)
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.value = value
  })

  return <textarea ref={ref} defaultValue={value} {...props} />
}
