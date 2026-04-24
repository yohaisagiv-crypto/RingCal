import { useRef, useEffect } from 'react'

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (val: string) => void
}

export function NativeInput({ value, onChange, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  // Set initial value on mount only
  useEffect(() => {
    if (ref.current) ref.current.value = value
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen via native DOM event — bypasses React synthetic event issues with Android IME
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onInput = () => onChange(el.value)
    const onCompose = () => onChange(el.value)
    el.addEventListener('input', onInput)
    el.addEventListener('compositionend', onCompose)
    return () => {
      el.removeEventListener('input', onInput)
      el.removeEventListener('compositionend', onCompose)
    }
  }, [onChange])

  // Sync value from outside only when not focused
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.value = value
  })

  // No value/defaultValue prop — React never touches el.value
  return <input ref={ref} {...props} />
}

interface TAProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string
  onChange: (val: string) => void
}

export function NativeTextarea({ value, onChange, ...props }: TAProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.value = value
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onInput = () => onChange(el.value)
    const onCompose = () => onChange(el.value)
    el.addEventListener('input', onInput)
    el.addEventListener('compositionend', onCompose)
    return () => {
      el.removeEventListener('input', onInput)
      el.removeEventListener('compositionend', onCompose)
    }
  }, [onChange])

  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.value = value
  })

  return <textarea ref={ref} {...props} />
}
