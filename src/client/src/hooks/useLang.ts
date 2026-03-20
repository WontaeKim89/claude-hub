import { useState, useCallback } from 'react'
import { getLang, setLang, t as translate } from '../lib/i18n'

export function useLang() {
  const [lang, _setLang] = useState(getLang())

  const toggleLang = useCallback(() => {
    const next = lang === 'ko' ? 'en' : 'ko'
    setLang(next)
    _setLang(next)
  }, [lang])

  const t = useCallback((key: string) => translate(key), [lang])

  return { lang, toggleLang, t }
}
