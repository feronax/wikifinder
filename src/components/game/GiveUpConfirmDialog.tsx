'use client'

import React, { useEffect, useRef, useId } from 'react'

interface GiveUpConfirmDialogProps {
    open: boolean
    livesRemaining: number
    onCancel: () => void
    onConfirm: () => void
    t: {
        title: string
        body: (nextLives: number) => string
        confirm: string
        cancel: string
    }
}

export default function GiveUpConfirmDialog({
    open,
    livesRemaining,
    onCancel,
    onConfirm,
    t,
}: GiveUpConfirmDialogProps) {
    const cancelRef = useRef<HTMLButtonElement>(null)
    const confirmRef = useRef<HTMLButtonElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)
    const headingId = useId()

    useEffect(() => {
        if (!open) return
        // Focus Cancel on mount
        cancelRef.current?.focus()

        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
                return
            }
            if (e.key === 'Tab') {
                // Trap focus between Cancel and Confirm
                const active = document.activeElement
                if (e.shiftKey) {
                    if (active === cancelRef.current) {
                        e.preventDefault()
                        confirmRef.current?.focus()
                    }
                } else {
                    if (active === confirmRef.current) {
                        e.preventDefault()
                        cancelRef.current?.focus()
                    }
                }
            }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [open, onCancel])

    if (!open) return null

    const nextLives = Math.max(0, livesRemaining - 1)

    function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
        if (e.target === overlayRef.current) {
            onCancel()
        }
    }

    return (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={headingId}
                className="reveal-animation"
                style={{
                    backgroundColor: 'var(--surface)',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: 24,
                    maxWidth: 360,
                    width: '100%',
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--text)',
                }}
            >
                <h2
                    id={headingId}
                    style={{
                        fontSize: 20,
                        fontWeight: 600,
                        marginBottom: 12,
                        lineHeight: 1.2,
                        color: 'var(--text)',
                    }}
                >
                    {t.title}
                </h2>
                <p
                    style={{
                        fontSize: 16,
                        fontWeight: 400,
                        lineHeight: 1.5,
                        marginBottom: 20,
                        color: 'var(--text-muted)',
                    }}
                >
                    {t.body(nextLives)}
                </p>
                <div
                    style={{
                        display: 'flex',
                        gap: 12,
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                    }}
                >
                    <button
                        ref={cancelRef}
                        onClick={onCancel}
                        style={{
                            padding: '10px 20px',
                            minHeight: 44,
                            fontSize: 14,
                            fontWeight: 500,
                            borderRadius: 8,
                            border: 'none',
                            backgroundColor: 'var(--accent)',
                            color: 'white',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-sans)',
                        }}
                    >
                        {t.cancel}
                    </button>
                    <button
                        ref={confirmRef}
                        onClick={onConfirm}
                        style={{
                            padding: '10px 20px',
                            minHeight: 44,
                            fontSize: 14,
                            fontWeight: 500,
                            borderRadius: 8,
                            border: '1px solid var(--destructive)',
                            backgroundColor: 'transparent',
                            color: 'var(--destructive)',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-sans)',
                        }}
                    >
                        {t.confirm}
                    </button>
                </div>
            </div>
        </div>
    )
}
