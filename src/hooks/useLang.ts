import { useAppStore } from '../store/useAppStore'
import { getLang } from '../i18n/translations'

export function useLang() {
  const language = useAppStore(s => s.settings.language)
  const tr = getLang(language)
  const rtl = language === 'he' || language === 'ar'
  return { tr, rtl, language }
}
