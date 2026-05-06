import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useDarkMode() {
  const darkMode = useAppStore(s => s.settings.darkMode)
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [darkMode])
}
