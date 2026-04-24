import { useRef, useEffect, useLayoutEffect, useCallback } from 'react'

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (val: string) => void
}

export function NativeInput({ value, onChange, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => onChange(el.value)
    el.addEventListener('input', handler)
    return () => el.removeEventListener('input', handler)
  }, [onChange])

  useLayoutEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.value = value
  }, [value])

  return <input ref={ref} defaultValue={value} {...props} />
}

interface TAProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string
  onChange: (val: string) => void
}

export function NativeTextarea({ value, onChange, ...props }: TAProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => onChange(el.value)
    el.addEventListener('input', handler)
    return () => el.removeEventListener('input', handler)
  }, [onChange])

  useLayoutEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.value = value
  }, [value])

  return <textarea ref={ref} defaultValue={value} {...props} />
}
