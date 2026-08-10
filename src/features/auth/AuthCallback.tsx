import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LayarMuat } from '@/components/LayarMuat'
import { useAuth } from './AuthProvider'

/**
 * Tujuan redirect Google. Supabase (flow PKCE, detectSessionInUrl) yang menukar
 * kode di URL menjadi sesi; halaman ini hanya menunggu lalu mengarahkan sesuai role.
 * Inilah "satu pintu login" itu: admin ke dashboard, selain itu ke beranda.
 */
export function AuthCallback() {
  const { session, profile, loading } = useAuth()
  const [terlaluLama, setTerlaluLama] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTerlaluLama(true), 8000)
    return () => clearTimeout(t)
  }, [])

  if (loading || (session && !profile && !terlaluLama)) {
    return <LayarMuat pesan="Menyiapkan akunmu…" />
  }
  if (!session) return <Navigate to="/masuk" replace />
  return <Navigate to={profile?.role === 'admin' ? '/admin' : '/'} replace />
}
