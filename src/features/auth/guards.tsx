import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { LayarMuat } from '@/components/LayarMuat'
import { profilLengkap } from '@/lib/profil'

/**
 * Wajib sudah masuk DAN profilnya lengkap.
 *
 * Gerbang profil sengaja dipasang di sini, satu tempat, agar berlaku untuk seluruh
 * halaman customer maupun admin. Penegakan sebenarnya tetap ada di dalam RPC
 * `reserve_slot()` — layar ini hanya membuat alurnya jelas, bukan jadi satu-satunya
 * pengaman.
 */
export function ButuhLogin() {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LayarMuat />
  if (!session) return <Navigate to="/masuk" state={{ dari: location.pathname }} replace />
  // Profil masih null sesaat setelah login pertama; tunggu, jangan menebak.
  if (!profile) return <LayarMuat />
  if (!profilLengkap(profile)) return <Navigate to="/lengkapi-profil" replace />
  return <Outlet />
}

/**
 * Cukup sudah masuk, tanpa syarat profil lengkap. Dipakai khusus oleh halaman
 * /lengkapi-profil — kalau halaman itu dibungkus ButuhLogin, ia akan mengarahkan
 * ke dirinya sendiri terus-menerus.
 */
export function ButuhSesi() {
  const { session, loading } = useAuth()

  if (loading) return <LayarMuat />
  if (!session) return <Navigate to="/masuk" replace />
  return <Outlet />
}

/** Wajib admin. Customer yang memaksa membuka /admin dilempar balik ke beranda. */
export function ButuhAdmin() {
  const { session, profile, loading } = useAuth()

  if (loading) return <LayarMuat />
  if (!session) return <Navigate to="/masuk" replace />
  if (!profile) return <LayarMuat />
  if (profile.role !== 'admin') return <Navigate to="/" replace />
  if (!profilLengkap(profile)) return <Navigate to="/lengkapi-profil" replace />
  return <Outlet />
}

/** Halaman login: yang sudah masuk langsung diarahkan sesuai perannya. */
export function TamuSaja() {
  const { session, profile, loading } = useAuth()

  if (loading) return <LayarMuat />
  if (session && profile) {
    if (!profilLengkap(profile)) return <Navigate to="/lengkapi-profil" replace />
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/'} replace />
  }
  if (session && !profile) return <LayarMuat />
  return <Outlet />
}
