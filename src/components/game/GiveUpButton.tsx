'use client'

import React, { useState } from 'react'
import GiveUpConfirmDialog from './GiveUpConfirmDialog'

interface GiveUpButtonProps {
    livesRemaining: number
    onConfirm: () => void
    disabled?: boolean
    t: {
        label: string
        dialog: {
            title: string
            body: (nextLives: number) => string
            confirm: string
            cancel: string
        }
    }
}

export default function GiveUpButton({
    livesRemaining,
    onConfirm,
    disabled,
    t,
}: GiveUpButtonProps) {
    const [open, setOpen] = useState(false)

    function handleConfirm() {
        setOpen(false)
        onConfirm()
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
                style={{
                    padding: '8px 16px',
                    minHeight: 44,
                    fontSize: 14,
                    fontWeight: 500,
                    borderRadius: 8,
                    border: '1px solid var(--destructive)',
                    backgroundColor: 'transparent',
                    color: 'var(--destructive)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                    fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap',
                }}
            >
                {t.label}
            </button>
            <GiveUpConfirmDialog
                open={open}
                livesRemaining={livesRemaining}
                onCancel={() => setOpen(false)}
                onConfirm={handleConfirm}
                t={t.dialog}
            />
        </>
    )
}
