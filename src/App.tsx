import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { LayarMuat } from '@/components/LayarMuat'
import { queryClient } from '@/lib/query-client'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ButuhAdmin, ButuhLogin, ButuhSesi, TamuSaja } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { AuthCallback } from '@/features/auth/AuthCallback'
import { LengkapiProfilPage } from '@/features/auth/LengkapiProfilPage'

import { CustomerShell } from '@/features/customer/CustomerShell'
import { WarPage } from '@/features/customer/WarPage'
import { PesananPage } from '@/features/customer/PesananPage'
import { PeringkatPage } from '@/features/customer/PeringkatPage'
import { ProfilPage } from '@/features/customer/ProfilPage'

/*
 * Dashboard admin dimuat terpisah. Sebagian besar pengguna adalah customer, dan
 * mereka tidak perlu ikut mengunduh Recharts + seluruh layar admin.
 */
const AdminShell = lazy(() =>
  import('@/features/admin/AdminShell').then((m) => ({ default: m.AdminShell })),
)
const EventTerpilihProvider = lazy(() =>
  import('@/features/admin/event-terpilih').then((m) => ({ default: m.EventTerpilihProvider })),
)
const RingkasanPage = lazy(() =>
  import('@/features/admin/RingkasanPage').then((m) => ({ default: m.RingkasanPage })),
)
const ApprovalPage = lazy(() =>
  import('@/features/admin/ApprovalPage').then((m) => ({ default: m.ApprovalPage })),
)
const MenuPage = lazy(() =>
  import('@/features/admin/MenuPage').then((m) => ({ default: m.MenuPage })),
)
const KeuanganPage = lazy(() =>
  import('@/features/admin/KeuanganPage').then((m) => ({ default: m.KeuanganPage })),
)
const PesertaPage = lazy(() =>
  import('@/features/admin/PesertaPage').then((m) => ({ default: m.PesertaPage })),
)
const PengaturanPage = lazy(() =>
  import('@/features/admin/PengaturanPage').then((m) => ({ default: m.PengaturanPage })),
)

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route element={<TamuSaja />}>
              <Route path="/masuk" element={<LoginPage />} />
            </Route>

            {/* Di luar ButuhLogin, kalau tidak halaman ini akan mengarahkan ke dirinya sendiri. */}
            <Route element={<ButuhSesi />}>
              <Route path="/lengkapi-profil" element={<LengkapiProfilPage />} />
            </Route>

            {/* Tampilan customer */}
            <Route element={<ButuhLogin />}>
              <Route element={<CustomerShell />}>
                <Route index element={<WarPage />} />
                <Route path="pesanan" element={<PesananPage />} />
                <Route path="peringkat" element={<PeringkatPage />} />
                <Route path="profil" element={<ProfilPage />} />
              </Route>
            </Route>

            {/* Dashboard admin */}
            <Route element={<ButuhAdmin />}>
              <Route
                path="/admin"
                element={
                  <Suspense fallback={<LayarMuat />}>
                    <EventTerpilihProvider>
                      <AdminShell />
                    </EventTerpilihProvider>
                  </Suspense>
                }
              >
                <Route index element={<RingkasanPage />} />
                <Route path="approval" element={<ApprovalPage />} />
                <Route path="menu" element={<MenuPage />} />
                <Route path="keuangan" element={<KeuanganPage />} />
                <Route path="peserta" element={<PesertaPage />} />
                <Route path="pengaturan" element={<PengaturanPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
