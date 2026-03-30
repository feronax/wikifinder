import { useEffect, useState } from 'react'

export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])
    return isMobile
}

export function calculateScore(guessCount: number, completed: boolean): number {
    if (!completed || guessCount > 400) return 0
    const wRaw = Math.max(0, guessCount - 70)
    const w = wRaw / (400 - 70)
    return Math.round(5000 * Math.exp(-3.5 * w))
}
