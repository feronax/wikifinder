'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import SurvivalCard from '@/components/game/SurvivalCard'
import DuelCard from '@/components/duel/DuelCard'

const masked = (w: number) => ({
  display: 'inline-block',
  backgroundColor: 'var(--masked)',
  borderRadius: 3,
  width: w,
  height: '1.3em',
  verticalAlign: 'middle',
  margin: '0 2px',
})

const revealed = {
  fontWeight: 700 as const,
  color: 'var(--accent)',
}

const stopword = {
  color: 'var(--text-muted)',
}

const translations = {
  fr: {
    subtitle: 'Chaque jour, un article Wikipedia à deviner.',
    subtitle2: 'Mot par mot. En un minimum de tentatives.',
    play: 'Jouer',
    howItWorks: 'Comment ça marche ?',
    step1title: 'Un article Wikipedia est sélectionné',
    step1desc: 'Tous les mots sont masqués sauf les mots courants (le, de, un, est...). Le titre est aussi masqué — c\'est lui que tu dois trouver.',
    step1label: 'Titre :',
    step2title: 'Tu proposes un mot',
    step2desc: 'Par exemple "pays". S\'il apparaît dans l\'article, il se révèle partout dans le texte.',
    step2input: 'pays',
    step2label: 'Tentative 1 :',
    step3title: 'Tu continues jusqu\'à trouver le titre',
    step3desc: 'Chaque mot trouvé te donne des indices. Ici après quelques essais, le joueur devine "États" puis "Unis" — victoire !',
    step3label: 'Trouvé en 12 tentatives !',
    goalTitle: 'L\'objectif',
    goalDesc: 'Trouve tous les mots du titre en un minimum de tentatives. Moins de tentatives = meilleur score !',
    features: [
      { icon: '🔥', label: 'Streaks quotidiens' },
      { icon: '🏆', label: 'Classement global' },
      { icon: '📊', label: 'Statistiques perso' },
      { icon: '🌍', label: 'Français & Anglais' },
    ],
    faq: 'Questions fréquentes',
    faqs: [
      { q: 'C\'est quoi Wikifinder ?', a: 'Wikifinder est un jeu quotidien gratuit où tu dois deviner un article Wikipedia mot par mot. Chaque jour, un nouvel article est sélectionné — les mots sont masqués et tu dois les révéler en proposant des mots.' },
      { q: 'Comment on joue ?', a: 'Tu tapes un mot dans le champ de saisie. Si ce mot apparaît dans l\'article, il se révèle partout dans le texte. Ton objectif est de trouver tous les mots du titre de l\'article en un minimum de tentatives.' },
      { q: 'Est-ce que je dois créer un compte ?', a: 'Non, tu peux jouer sans compte. Mais en créant un compte gratuit, tu peux sauvegarder ta progression, suivre tes streaks, apparaître dans le classement et accéder à tes statistiques.' },
      { q: 'À quelle heure le nouvel article est disponible ?', a: 'Un nouvel article est disponible chaque jour à minuit (heure de Paris). Tu reçois une notification si tu les as activées.' },
      { q: 'Le jeu est disponible en anglais ?', a: 'Oui ! Tu peux jouer en français ou en anglais. Chaque article existe dans les deux langues avec un contenu différent.' },
      { q: 'Comment le score est-il calculé ?', a: 'Le score dépend du nombre de tentatives. Moins tu fais de tentatives, plus ton score est élevé. Le score maximum est de 5 000 points.' },
    ],
    cta: 'Commencer la partie du jour',
    noAccount: 'Gratuit, pas besoin de compte',
    survival: {
      eyebrow: 'Mode Survie',
      heading: 'Survival',
      subtitle: 'Enchaîne les articles. Perds une vie quand tu abandonnes.',
      langLabel: 'Langue de la run',
      startCta: 'Lancer un Survival',
      resumeHeading: 'Reprendre ta run',
      resumeMeta: (chain: number, lives: number) => `Chaîne ${chain} · ${lives} vie${lives > 1 ? 's' : ''} restante${lives > 1 ? 's' : ''}`,
      resumeCta: (chain: number, lives: number) => `Reprendre — chaîne ${chain}, ${lives} vie${lives > 1 ? 's' : ''}`,
      signInCta: 'Se connecter pour jouer Survival',
      livesAria: (n: number, total: number) => `Vies restantes : ${n} sur ${total}`,
    },
  },
  en: {
    subtitle: 'Every day, a Wikipedia article to guess.',
    subtitle2: 'Word by word. In as few attempts as possible.',
    play: 'Play',
    howItWorks: 'How does it work?',
    step1title: 'A Wikipedia article is selected',
    step1desc: 'All words are hidden except common ones (the, of, a, is...). The title is also hidden — that\'s what you need to find.',
    step1label: 'Title:',
    step2title: 'You guess a word',
    step2desc: 'For example "country". If it appears in the article, it gets revealed everywhere in the text.',
    step2input: 'country',
    step2label: 'Guess 1:',
    step3title: 'Keep going until you find the title',
    step3desc: 'Each word you find gives you clues. Here after a few guesses, the player guesses "United" then "States" — victory!',
    step3label: 'Found in 12 guesses!',
    goalTitle: 'The goal',
    goalDesc: 'Find all the words in the title in as few guesses as possible. Fewer guesses = higher score!',
    features: [
      { icon: '🔥', label: 'Daily streaks' },
      { icon: '🏆', label: 'Global leaderboard' },
      { icon: '📊', label: 'Personal stats' },
      { icon: '🌍', label: 'French & English' },
    ],
    faq: 'Frequently Asked Questions',
    faqs: [
      { q: 'What is Wikifinder?', a: 'Wikifinder is a free daily game where you guess a Wikipedia article word by word. Every day, a new article is selected — words are hidden and you must reveal them by guessing.' },
      { q: 'How do I play?', a: 'Type a word in the input field. If it appears in the article, it gets revealed everywhere in the text. Your goal is to find all the words in the article\'s title in as few guesses as possible.' },
      { q: 'Do I need to create an account?', a: 'No, you can play without an account. But by creating a free account, you can save your progress, track streaks, appear on the leaderboard, and access your stats.' },
      { q: 'When is the new article available?', a: 'A new article is available every day at midnight (Paris time). You\'ll get a notification if you\'ve enabled them.' },
      { q: 'Is the game available in French?', a: 'Yes! You can play in French or English. Each article exists in both languages with different content.' },
      { q: 'How is the score calculated?', a: 'The score depends on the number of guesses. Fewer guesses means a higher score. The maximum score is 5,000 points.' },
    ],
    cta: 'Start today\'s game',
    noAccount: 'Free, no account needed',
    survival: {
      eyebrow: 'Survival Mode',
      heading: 'Survival',
      subtitle: 'Chain articles. Lose a life when you give up.',
      langLabel: 'Run language',
      startCta: 'Start Survival',
      resumeHeading: 'Resume your run',
      resumeMeta: (chain: number, lives: number) => `Chain ${chain} · ${lives} life${lives > 1 ? ' lives' : ''} remaining`,
      resumeCta: (chain: number, lives: number) => `Resume — chain ${chain}, ${lives} life${lives > 1 ? ' lives' : ''} left`,
      signInCta: 'Sign in to play Survival',
      livesAria: (n: number, total: number) => `Lives remaining: ${n} of ${total}`,
    },
  },
}

export default function LandingPage() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [resumeState, setResumeState] = useState<{ chainLength: number; livesRemaining: number; language: 'fr' | 'en' } | null>(null)
  const [duelState, setDuelState] = useState<{ id: string; state: 'waiting' | 'your-turn' | 'ready'; expiresAt: string } | null>(null)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    // Landing is the tutorial/onboarding surface for anonymous visitors.
    // Authed users are redirected to /game (their daily play surface).
    // The TodayFeedCard social surface moved to a dedicated /friends route
    // so that logged-in users never need to revisit the anon tutorial.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        window.location.replace('/game')
        return
      }
      setUser(null)
      setChecking(false)
    })
  }, [])

  // [landing/survival-resume] Fetch active survival run, if any — drives SurvivalCard Resume state (UI-SPEC §Surface 1).
  useEffect(() => {
    if (!user) { setResumeState(null); return }
    supabase
      .from('games')
      .select('id, mode_config, lang')
      .eq('user_id', user.id)
      .eq('mode', 'survival')
      .is('completed_at', null)
      .filter('mode_config->>lives_remaining', 'gt', '0')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: { id: string; mode_config: unknown; lang: string } | null }) => {
        if (!data) { setResumeState(null); return }
        // Pitfall 3: PostgREST compares jsonb->>text lexicographically; at 1-digit life cap, 'gt' '0' is safe.
        const mc = data.mode_config as { chain?: unknown[]; lives_remaining?: number | string; language?: string } | null
        setResumeState({
          chainLength: Array.isArray(mc?.chain) ? mc!.chain!.length : 0,
          livesRemaining: Number(mc?.lives_remaining ?? 0),
          language: ((mc?.language ?? data.lang ?? 'fr') as 'fr' | 'en'),
        })
      })
  }, [user])

  // [landing/duel-state] Most recently active duel room for this user (D-11) — derives home DuelCard state.
  useEffect(() => {
    if (!user) { setDuelState(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const { data: rp } = await supabase
          .from('room_players')
          .select('room_id, user_id, game_id, multiplayer_rooms!inner(id, expires_at, updated_at)')
          .eq('user_id', user.id)
          .order('multiplayer_rooms(updated_at)', { ascending: false })
          .limit(1)
        const first = Array.isArray(rp) ? rp[0] : null
        if (!first) { if (!cancelled) setDuelState(null); return }
        const roomRaw = (first as { multiplayer_rooms?: { id: string; expires_at: string } | { id: string; expires_at: string }[] }).multiplayer_rooms
        const room = Array.isArray(roomRaw) ? roomRaw[0] : roomRaw
        if (!room) { if (!cancelled) setDuelState(null); return }
        const res = await fetch(`/api/duel/${room.id}`, { cache: 'no-store' })
        const body = await res.json()
        if (cancelled) return
        if (!res.ok || body.error) { setDuelState(null); return }
        const serverState = body.state as 'lobby' | 'waiting' | 'ready' | 'expired-one' | 'expired-none' | 'private'
        if (serverState === 'ready' || serverState === 'expired-one') {
          setDuelState({ id: room.id, state: 'ready', expiresAt: room.expires_at })
        } else if (serverState === 'waiting') {
          setDuelState({ id: room.id, state: 'waiting', expiresAt: room.expires_at })
        } else if (serverState === 'lobby' && body.opponent?.state === 'finished') {
          setDuelState({ id: room.id, state: 'your-turn', expiresAt: room.expires_at })
        } else {
          setDuelState(null)
        }
      } catch {
        // Silent: home card simply falls back to idle.
      }
    })()
    return () => { cancelled = true }
  }, [user])

  const t = translations[lang]

  if (checking) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }} />
  )

  const cardStyle = {
    padding: 24,
    borderRadius: 12,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
    marginBottom: 16,
  }

  const stepNumStyle = {
    width: 32, height: 32, borderRadius: '50%',
    backgroundColor: 'var(--accent)', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, fontWeight: 700, flexShrink: 0,
  } as const

  const demoBoxStyle = {
    marginTop: 16,
    padding: '16px 20px',
    borderRadius: 8,
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    fontSize: 15,
    lineHeight: 2.2,
    color: 'var(--text)',
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg)',
      fontFamily: 'var(--font-sans)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Lang switch */}
      <div style={{ width: '100%', maxWidth: 680, padding: '16px 24px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['fr', 'en'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
              backgroundColor: lang === l ? 'var(--accent)' : 'transparent',
              color: lang === l ? 'white' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: '0.2s',
            }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Hero */}
      <div style={{ width: '100%', maxWidth: 680, padding: '40px 24px 32px', textAlign: 'center' }}>
        <div style={{ marginBottom: 16 }}>
          <img src="/icon-192.png" alt="Wikifinder" width={80} height={80} style={{ borderRadius: '50%' }} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, color: 'var(--text)', margin: '0 0 12px', lineHeight: 1.1 }}>
          Wikifinder
        </h1>
        <p style={{ fontSize: 18, color: 'var(--text-muted)', margin: '0 0 28px', lineHeight: 1.5 }}>
          {t.subtitle}<br />{t.subtitle2}
        </p>
        <a href="/game" style={{
          display: 'inline-block', padding: '14px 36px', borderRadius: 10,
          backgroundColor: 'var(--accent)', color: 'white', fontSize: 17,
          fontWeight: 600, textDecoration: 'none', fontFamily: 'var(--font-sans)',
        }}>
          {user ? (lang === 'fr' ? "Jouer l'article du jour →" : "Play today's article →") : t.play}
        </a>
      </div>

      {/* Duel card (Plan 04-04) */}
      <div style={{ width: '100%', maxWidth: 680, padding: '0 24px 16px' }}>
        <DuelCard
          state={!user ? 'anon' : duelState?.state ?? 'idle'}
          expiresAt={duelState?.expiresAt}
          lang={lang}
          onPrimary={() => {
            if (!user) { window.location.href = '/login?next=/'; return }
            if (duelState) { window.location.href = `/duel/${duelState.id}`; return }
            ;(async () => {
              try {
                const res = await fetch('/api/duel/create', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ lang, idempotencyKey: crypto.randomUUID() }),
                })
                const body = await res.json()
                if (res.ok && body?.duelUrl) {
                  const url = `${window.location.origin}${body.duelUrl}`
                  const nav = navigator as Navigator & { share?: (d: { url?: string }) => Promise<void> }
                  try {
                    if (typeof nav.share === 'function') await nav.share({ url })
                    else if (navigator.clipboard) await navigator.clipboard.writeText(url)
                  } catch { /* user cancelled share */ }
                  window.location.href = body.duelUrl
                }
              } catch { /* HARD-04 no-console silent */ }
            })()
          }}
        />
      </div>

      {/* Survival card (Plan 03-05) */}
      <div style={{ width: '100%', maxWidth: 680, padding: '0 24px 16px' }}>
        <SurvivalCard
          resumeState={resumeState}
          isAuthed={Boolean(user)}
          defaultLang={lang}
          onStart={(pickedLang) => { window.location.href = `/game?mode=survival&lang=${pickedLang}` }}
          onResume={() => { window.location.href = '/game?mode=survival' }}
          onSignIn={() => { window.location.href = '/login?next=/game?mode=survival' }}
          t={t.survival}
        />
      </div>

      {/* Tutoriel étape par étape */}
      <div style={{ width: '100%', maxWidth: 680, padding: '12px 24px 40px' }}>
        <h2 style={{
          fontSize: 20, fontWeight: 700, color: 'var(--text)', textAlign: 'center', marginBottom: 24,
        }}>
          {t.howItWorks}
        </h2>

        {/* Étape 1 : Article masqué */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={stepNumStyle}>1</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{t.step1title}</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{t.step1desc}</div>
            </div>
          </div>

          {/* Titre masqué */}
          <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 8, backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
              {t.step1label}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={masked(55)} />
              <span style={masked(40)} />
            </div>
          </div>

          {/* Contenu masqué */}
          <div style={demoBoxStyle}>
            {lang === 'fr' ? (
              <>
                <span style={stopword}>Les </span><span style={masked(45)} /><span style={stopword}>{' '}sont </span><span style={masked(25)} /><span style={stopword}> des </span><span style={masked(60)} /><span style={stopword}> en </span><span style={masked(55)} /><span style={stopword}> du </span><span style={masked(35)} /><span style={stopword}>. </span>
                <span style={stopword}>Le </span><span style={masked(40)} /><span style={stopword}> est une </span><span style={masked(65)} /><span style={stopword}> de </span><span style={masked(40)} /><span style={stopword}> à </span><span style={masked(70)} /><span style={stopword}>.</span>
              </>
            ) : (
              <>
                <span style={stopword}>The </span><span style={masked(45)} /><span style={stopword}>{' '}is a </span><span style={masked(50)} /><span style={stopword}> in </span><span style={masked(40)} /><span style={stopword}>. </span>
                <span style={stopword}>It is the </span><span style={masked(40)} /><span style={stopword}> most </span><span style={masked(55)} /><span style={stopword}> and the </span><span style={masked(40)} /><span style={stopword}> most </span><span style={masked(60)} /><span style={stopword}>.</span>
              </>
            )}
          </div>
        </div>

        {/* Étape 2 : Premier guess */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={stepNumStyle}>2</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{t.step2title}</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{t.step2desc}</div>
            </div>
          </div>

          {/* Input simulé */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 12 }}>
            <div style={{
              flex: 1, padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--border)', backgroundColor: 'var(--bg)',
              fontSize: 15, color: 'var(--text)',
            }}>
              {t.step2input}
            </div>
            <div style={{
              padding: '10px 20px', borderRadius: 8, backgroundColor: 'var(--accent)',
              color: 'white', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center',
            }}>
              {lang === 'fr' ? 'Valider' : 'Submit'}
            </div>
          </div>

          {/* Contenu avec mot révélé */}
          <div style={demoBoxStyle}>
            {lang === 'fr' ? (
              <>
                <span style={stopword}>Les </span><span style={masked(45)} /><span style={stopword}>{' '}sont </span><span style={masked(25)} /><span style={stopword}> des </span><span style={masked(60)} /><span style={stopword}> en </span><span style={masked(55)} /><span style={stopword}> du </span><span style={masked(35)} /><span style={stopword}>. </span>
                <span style={stopword}>Le </span><span style={revealed}>pays</span><span style={stopword}> est une </span><span style={masked(65)} /><span style={stopword}> de </span><span style={masked(40)} /><span style={stopword}> à </span><span style={masked(70)} /><span style={stopword}>.</span>
              </>
            ) : (
              <>
                <span style={stopword}>The </span><span style={revealed}>country</span><span style={stopword}>{' '}is a </span><span style={masked(50)} /><span style={stopword}> in </span><span style={masked(40)} /><span style={stopword}>. </span>
                <span style={stopword}>It is the </span><span style={masked(40)} /><span style={stopword}> most </span><span style={masked(55)} /><span style={stopword}> and the </span><span style={masked(40)} /><span style={stopword}> most </span><span style={masked(60)} /><span style={stopword}>.</span>
              </>
            )}
          </div>
        </div>

        {/* Étape 3 : Victoire */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={stepNumStyle}>3</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{t.step3title}</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{t.step3desc}</div>
            </div>
          </div>

          {/* Titre trouvé */}
          <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 8, backgroundColor: 'var(--bg)', border: '1px solid var(--accent)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
              {t.step1label}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 22 }}>
              <span style={revealed}>{lang === 'fr' ? 'États' : 'United'}</span>
              <span style={revealed}>{'-'}</span>
              <span style={revealed}>{lang === 'fr' ? 'Unis' : 'States'}</span>
            </div>
          </div>

          {/* Message victoire */}
          <div style={{
            marginTop: 12, padding: '12px 16px', borderRadius: 8,
            backgroundColor: 'var(--revealed)', border: '1px solid var(--accent)',
            textAlign: 'center', color: 'var(--accent)', fontWeight: 600, fontSize: 15,
          }}>
            {t.step3label}
          </div>

          {/* Contenu révélé */}
          <div style={demoBoxStyle}>
            {lang === 'fr' ? (
              <>
                <span style={stopword}>Les </span><span style={revealed}>États</span><span style={stopword}>{'-'}</span><span style={revealed}>Unis</span><span style={stopword}>{' '}sont </span><span style={revealed}>officiellement</span><span style={stopword}> des </span><span style={revealed}>républiques</span><span style={stopword}> en </span><span style={revealed}>Amérique</span><span style={stopword}> du </span><span style={revealed}>Nord</span><span style={stopword}>. </span>
                <span style={stopword}>Le </span><span style={revealed}>pays</span><span style={stopword}> est une </span><span style={revealed}>fédération</span><span style={stopword}> de </span><span style={revealed}>cinquante</span><span style={stopword}> à </span><span style={revealed}>Washington</span><span style={stopword}>.</span>
              </>
            ) : (
              <>
                <span style={stopword}>The </span><span style={revealed}>United</span><span style={stopword}>{' '}</span><span style={revealed}>States</span><span style={stopword}>{' '}is a </span><span style={revealed}>country</span><span style={stopword}> in </span><span style={revealed}>North</span><span style={stopword}>{' '}</span><span style={revealed}>America</span><span style={stopword}>. </span>
                <span style={stopword}>It is the </span><span style={revealed}>world</span><span style={stopword}>&apos;s most </span><span style={revealed}>powerful</span><span style={stopword}> and the </span><span style={revealed}>third</span><span style={stopword}> most </span><span style={revealed}>populous</span><span style={stopword}>.</span>
              </>
            )}
          </div>
        </div>

        {/* Objectif */}
        <div style={{
          ...cardStyle,
          textAlign: 'center',
          border: '1px solid var(--accent)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t.goalTitle}</div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.goalDesc}</div>
        </div>
      </div>

      {/* Features */}
      <div style={{
        width: '100%', maxWidth: 680, padding: '0 24px 40px',
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
      }}>
        {t.features.map((f, i) => (
          <div key={i} style={{
            padding: 16, borderRadius: 10, border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)', textAlign: 'center',
            fontSize: 14, color: 'var(--text)', fontWeight: 500,
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
            {f.label}
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div id="faq" style={{ width: '100%', maxWidth: 680, padding: '0 24px 40px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', textAlign: 'center', marginBottom: 20 }}>
          {t.faq}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {t.faqs.map((faq, i) => (
            <details key={i} style={{
              padding: '16px 20px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              cursor: 'pointer',
            }}>
              <summary style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
                {faq.q}
              </summary>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* FAQ JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: t.faqs.map(faq => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.a,
            },
          })),
        }) }}
      />

      {/* CTA final */}
      <div style={{ padding: '0 24px 60px', textAlign: 'center' }}>
        <a href="/game" style={{
          display: 'inline-block', padding: '14px 36px', borderRadius: 10,
          backgroundColor: 'var(--accent)', color: 'white', fontSize: 17,
          fontWeight: 600, textDecoration: 'none', fontFamily: 'var(--font-sans)',
        }}>
          {t.cta}
        </a>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>
          {t.noAccount}
        </div>
      </div>
    </div>
  )
}
