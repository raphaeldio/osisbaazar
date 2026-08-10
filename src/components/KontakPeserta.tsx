import { MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { keFormatWa } from '@/lib/profil'

/**
 * Kelas + tombol WhatsApp. Ini alasan data kontaknya dikumpulkan: panitia harus
 * bisa menghubungi pemesan dalam satu ketukan, bukan menyalin nomor manual.
 */
export function KontakPeserta({
  kelas,
  phone,
  nama,
}: {
  kelas: string | null
  phone: string | null
  nama?: string | null
}) {
  if (!kelas && !phone) return null

  const pesan = encodeURIComponent(
    `Halo${nama ? ` ${nama}` : ''}, ini panitia Bazaar OSIS soal PO kamu.`,
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {kelas && (
        <Badge variant="secondary" className="text-[10px] font-normal">
          {kelas}
        </Badge>
      )}
      {phone && (
        <a
          href={`https://wa.me/${keFormatWa(phone)}?text=${pesan}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="tabular inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <MessageCircle className="size-3" />
          {phone}
        </a>
      )}
    </div>
  )
}
