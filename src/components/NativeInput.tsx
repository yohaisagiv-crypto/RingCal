import { useRef, useEffect } from 'react'

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (val: string) => void
}

function makeListener(el: HTMLInputElement | HTMLTextAreaElement, onChangeRef: React.MutableRefObject<(v: string) => void>) {
  return (e: Event) => {
    const ie = e as InputEvent
    if (ie.inputType === 'deleteContentBackward' || ie.inputType === 'deleteContentForward') {
      // queueMicrotask gives the DOM time to finish the deletion before we read the value
      queueMicrotask(() => onChangeRef.current(el.value))
    } else {
      onChangeRef.current(el.value)
    }
  }
}

export function NativeInput({ value, onChange, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = makeListener(el, onChangeRef)
    el.addEventListener('input', handler)
    return () => el.removeEventListener('input', handler)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.value = value
  })

  return <input ref={ref} defaultValue={value} {...props} />
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
    const handler = makeListener(el, onChangeRef)
    el.addEventListener('input', handler)
    return () => el.removeEventListener('input', handler)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.value = value
  })

  return <textarea ref={ref} defaultValue={value} {...props} />
}
