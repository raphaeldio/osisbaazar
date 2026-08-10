import { Outlet } from 'react-router-dom'
import { CircleDollarSign, LayoutDashboard, Settings2, UtensilsCrossed, Users } from 'lucide-react'
import { NavBawah, type ItemNav } from '@/components/NavBawah'
import { useEventTerpilih } from './event-terpilih'
import { useOrdersAdmin, useOrdersRealtime } from '@/lib/queries/admin'
import { LayarMuat } from '@/components/LayarMuat'

export function AdminShell() {
  const { eventId, siap } = useEventTerpilih()
  const { data: orders } = useOrdersAdmin(eventId)
  useOrdersRealtime(eventId)

  // Yang perlu perhatian panitia: PO yang belum diputuskan, plus yang sudah
  // disetujui tapi uangnya belum masuk — keduanya menahan slot dari terjual.
  const perluTindakan =
    orders?.filter(
      (o) =>
        o.status === 'pending' ||
        (o.status === 'approved' && o.payment_status === 'unpaid'),
    ).length ?? 0

  const item: ItemNav[] = [
    { ke: '/admin', label: 'Ringkasan', icon: LayoutDashboard, persis: true },
    { ke: '/admin/approval', label: 'Approval', icon: Users, lencana: perluTindakan },
    { ke: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
    { ke: '/admin/keuangan', label: 'Keuangan', icon: CircleDollarSign },
    { ke: '/admin/pengaturan', label: 'Atur', icon: Settings2 },
  ]

  if (!siap) return <LayarMuat pesan="Memuat sesi bazaar…" />

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-4 pb-24">
        <Outlet />
      </div>
      <NavBawah item={item} />
    </div>
  )
}
