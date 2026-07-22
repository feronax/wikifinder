'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  loadLocalPrefs,
  saveLocalPrefs,
  usePreferenceSync,
  usePreferencesBootstrap,
} from '@/lib/preferences'

export type Lang = 'fr' | 'en'

type LangContextValue = {
  lang: Lang
  setLang: (next: Lang) => void
}

const LangContext = createContext<LangContextValue>({
  lang: 'fr',
  setLang: () => {},
})

export function useLang() {
  return useContext(LangContext)
}

function writeLangCookie(next: Lang) {
  if (typeof document === 'undefined') return
  document.cookie = 'wf_lang=' + next + '; Path=/; Max-Age=31536000; SameSite=Lax'
}

export default function LangProvider({
  initialLang,
  children,
}: {
  initialLang?: Lang
  children: React.ReactNode
}) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? 'fr')
  const userIdRef = useRef<string | null>(null)
  const queueSync = usePreferenceSync()

  useEffect(() => {
    const local = loadLocalPrefs()
    if (local.lang === 'fr' || local.lang === 'en') {
      setLangState(local.lang)
    }
     
  }, [])

  usePreferencesBootstrap({
    userIdRef,
    queueSync,
    onHydrated: (remote) => {
      if (remote.lang === 'fr' || remote.lang === 'en') {
        setLangState(remote.lang)
        writeLangCookie(remote.lang)
      }
    },
  })

  function setLang(next: Lang) {
    setLangState(next)
    saveLocalPrefs({ lang: next })
    writeLangCookie(next)
    queueSync({ lang: next }, userIdRef.current)
  }

  const value: LangContextValue = { lang, setLang }

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}
