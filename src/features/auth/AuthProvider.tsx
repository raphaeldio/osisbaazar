import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

type AuthState = {
  session: Session | null
  profile: Profile | null
  /** true selama sesi & profil belum selesai dimuat — jangan redirect dulu. */
  loading: boolean
  isAdmin: boolean
  masukDenganGoogle: () => Promise<void>
  keluar: () => Promise<void>
  muatUlangProfil: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * Profil dibuat oleh trigger `handle_new_user` tepat saat baris auth.users lahir.
 * Pada login pertama, request profil kadang menang balapan melawan trigger, jadi
 * dicoba ulang beberapa kali sebelum menyerah.
 */
async function ambilProfil(userId: string, percobaan = 0): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (data) return data

  if (percobaan < 4) {
    await new Promise((r) => setTimeout(r, 250 * (percobaan + 1)))
    return ambilProfil(userId, percobaan + 1)
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const sinkronkanProfil = useCallback(async (aktif: Session | null) => {
    if (!aktif?.user) {
      setProfile(null)
      return
    }
    try {
      setProfile(await ambilProfil(aktif.user.id))
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    let dibatalkan = false

    supabase.auth.getSession().then(async ({ data }) => {
      if (dibatalkan) return
      setSession(data.session)
      await sinkronkanProfil(data.session)
      if (!dibatalkan) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, aktif) => {
      setSession(aktif)
      // TOKEN_REFRESHED terjadi tiap jam; tidak perlu menembak ulang query profil.
      if (event === 'TOKEN_REFRESHED') return
      void sinkronkanProfil(aktif)
    })

    return () => {
      dibatalkan = true
      sub.subscription.unsubscribe()
    }
  }, [sinkronkanProfil])

  const masukDenganGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) throw error
  }, [])

  const keluar = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const muatUlangProfil = useCallback(async () => {
    await sinkronkanProfil(session)
  }, [session, sinkronkanProfil])

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        isAdmin: profile?.role === 'admin',
        masukDenganGoogle,
        keluar,
        muatUlangProfil,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
