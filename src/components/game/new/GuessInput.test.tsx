import React, { useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import GuessInput from './GuessInput'

// Mock the sacred-path gateway so we can assert it was NEVER called
// on duplicate short-circuit.
vi.mock('@/lib/client-hash', () => ({
  isWordInArticle: vi.fn(),
}))

import { isWordInArticle } from '@/lib/client-hash'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Small test harness: holds `input` state and exposes a spy `setInput`.
function Harness(props: {
  initial: string
  triedSet: Set<string>
  onReveal: (n: string, raw: string) => void
  onMiss: (w: string) => void
  setInputSpy: (v: string) => void
}) {
  const [input, setInputState] = useState(props.initial)
  const setInput = (v: string) => {
    props.setInputSpy(v)
    setInputState(v)
  }
  return (
    <GuessInput
      input={input}
      setInput={setInput}
      foundWordsByRecency={[]}
      triedSet={props.triedSet}
      onReveal={props.onReveal}
      onMiss={props.onMiss}
      gameId="test-game"
      lang="fr"
    />
  )
}

describe('GuessInput — duplicate-reject clears input (D-01)', () => {
  it('clears input and resets activeIndex when submitting an already-tried word', () => {
    const setInputSpy = vi.fn()
    const onReveal = vi.fn()
    const onMiss = vi.fn()
    const triedSet = new Set(['chat'])

    const { container } = render(
      <Harness
        initial="chat"
        triedSet={triedSet}
        onReveal={onReveal}
        onMiss={onMiss}
        setInputSpy={setInputSpy}
      />,
    )

    const form = container.querySelector('form')
    expect(form).toBeTruthy()
    fireEvent.submit(form!)

    // Sacred path must NEVER run on duplicate
    expect(isWordInArticle).not.toHaveBeenCalled()
    expect(onReveal).not.toHaveBeenCalled()
    expect(onMiss).not.toHaveBeenCalled()

    // Input must be cleared via setInput('')
    expect(setInputSpy).toHaveBeenCalledWith('')
  })

  it('does not clear input on empty submit (regression guard)', () => {
    const setInputSpy = vi.fn()
    const triedSet = new Set<string>(['chat'])

    const { container } = render(
      <Harness
        initial=""
        triedSet={triedSet}
        onReveal={vi.fn()}
        onMiss={vi.fn()}
        setInputSpy={setInputSpy}
      />,
    )

    const form = container.querySelector('form')
    fireEvent.submit(form!)

    // `setInput('')` should NOT fire from the submit path when raw is empty
    expect(setInputSpy).not.toHaveBeenCalledWith('')
  })
})
