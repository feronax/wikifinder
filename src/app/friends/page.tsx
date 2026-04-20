'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import Header from '@/components/Header'
import TodayFeedCard from '@/components/feed/TodayFeedCard'
import FollowSearchInput from '@/components/feed/FollowSearchInput'

export default function FriendsPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login?next=/friends')
        return
      }
      setAuthed(true)
      setChecking(false)
    })
  }, [])

  if (checking || !authed) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <Header lang={lang} onLangChange={setLang} />
      </div>
    )
  }

  const title = lang === 'fr' ? 'Amis' : 'Friends'
  const searchLabel = lang === 'fr' ? 'Trouver des joueurs' : 'Find players'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header lang={lang} onLangChange={setLang} />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ margin: '0 0 24px 0', fontSize: 28, color: 'var(--text)' }}>{title}</h1>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>
            {searchLabel}
          </div>
          <FollowSearchInput lang={lang} />
        </div>

        <TodayFeedCard lang={lang} />
      </div>
    </div>
  )
}
