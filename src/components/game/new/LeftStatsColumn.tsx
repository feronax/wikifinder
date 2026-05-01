'use client'

import React from 'react'
import GuessInput from '@/components/game/new/GuessInput'
import StatsCard from '@/components/game/new/StatsCard'
import ActionRow, { type ActionRowProps } from '@/components/game/new/ActionRow'

interface GuessInputProps {
  input: string
  setInput: (v: string) => void
  foundWordsByRecency: string[]
  triedWordsByRecency: string[]
  triedSet: Set<string>
  onReveal: (normalizedWord: string, rawWord: string) => void
  onMiss: (word: string) => void
  gameId: string | null
  lang: 'fr' | 'en'
  disabled?: boolean
}

interface StatsCardProps {
  elapsed: number
  attemptsCount: number
  foundCount: number
  totalRevealableTokens: number
  lang: 'fr' | 'en'
}

interface LeftStatsColumnProps {
  guessInputProps: GuessInputProps
  statsProps: StatsCardProps
  actionRowProps?: ActionRowProps
}

export default function LeftStatsColumn({
  guessInputProps,
  statsProps,
  actionRowProps,
}: LeftStatsColumnProps) {
  return (
    <aside
      style={{
        position: 'sticky',
        top: 80,
        alignSelf: 'flex-start',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 0,
      }}
    >
      <GuessInput {...guessInputProps} />
      <StatsCard {...statsProps} />
      {actionRowProps && <ActionRow {...actionRowProps} />}
    </aside>
  )
}
