import { useRef, useEffect } from 'react'

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (val: string) => void
}

export function NativeInput({ value, onChange, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Set up listener once — React never touches el.value again
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: Event) => onChangeRef.current((e.target as HTMLInputElement).value)
    el.addEventListener('input', handler)
    return () => el.removeEventListener('input', handler)
  }, [])

  // defaultValue sets initial value; React does NOT update it on re-renders
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
    const handler = (e: Event) => onChangeRef.current((e.target as HTMLTextAreaElement).value)
    el.addEventListener('input', handler)
    return () => el.removeEventListener('input', handler)
  }, [])

  return <textarea ref={ref} defaultValue={value} {...props} />
}
