import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ streak: 0, bestStreak: 0 })

    // Récupère toutes les dates où l'utilisateur a complété une partie
    const { data: games } = await supabaseAdmin
        .from('games')
        .select('completed, pages(date)')
        .eq('user_id', user.id)
        .eq('completed', true)

    if (!games || games.length === 0) return NextResponse.json({ streak: 0, bestStreak: 0 })

    // Extrait les dates uniques et trie décroissant
    const dates = [...new Set(
        games
            .map((g: any) => g.pages?.date)
            .filter(Boolean)
    )].sort((a, b) => b.localeCompare(a))

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Le streak courant ne compte que si la dernière partie est aujourd'hui ou hier
    let streak = 0
    if (dates[0] === today || dates[0] === yesterday) {
        streak = 1
        for (let i = 1; i < dates.length; i++) {
            const prev = new Date(dates[i - 1])
            const curr = new Date(dates[i])
            const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000)
            if (diff === 1) {
                streak++
            } else {
                break
            }
        }
    }

    // Calcule le meilleur streak historique
    let bestStreak = 1
    let currentBest = 1
    for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1])
        const curr = new Date(dates[i])
        const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000)
        if (diff === 1) {
            currentBest++
            bestStreak = Math.max(bestStreak, currentBest)
        } else {
            currentBest = 1
        }
    }

    return NextResponse.json({ streak, bestStreak })
}