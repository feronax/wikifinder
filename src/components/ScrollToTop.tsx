'use client'

import { useState, useEffect } from 'react'

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 300)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!visible) return null

  return (
    <div
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      style={{
        position: 'fixed',
        bottom: 84,
        right: 24,
        zIndex: 50,
        cursor: 'pointer',
        width: 48,
        height: 48,
        borderRadius: '50%',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        boxShadow: 'var(--shadow)',
      }}
    >
      ↑
    </div>
  )
}