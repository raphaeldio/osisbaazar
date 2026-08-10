import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { persen, rupiah, tanggal, tanggalJam } from '@/lib/format'
import { labelKategori, labelStatus, namaBerkas, type LaporanData } from './data'

const HIJAU: [number, number, number] = [46, 160, 116]
const ABU: [number, number, number] = [110, 110, 118]

/**
 * Laporan keuangan PDF berkop, siap dicetak dan dilampirkan ke LPJ.
 * Semua angka berasal dari PO yang sudah disetujui saja.
 */
export function exportPdf(data: LaporanData) {
  const { event, keuangan, performa, biaya, peserta, orders } = data
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const lebar = doc.internal.pageSize.getWidth()
  const margin = 40

  // --- Kop
  doc.setFillColor(...HIJAU)
  doc.rect(0, 0, lebar, 6, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Laporan Keuangan Bazaar', margin, 56)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...ABU)
  doc.text(event.name, margin, 74)
  doc.setFontSize(9)
  doc.text(`Dicetak ${tanggalJam(new Date())}`, margin, 90)
  doc.setTextColor(0, 0, 0)

  // --- Ringkasan
  autoTable(doc, {
    startY: 110,
    head: [['Ringkasan Keuangan', 'Nilai']],
    body: [
      ['Omzet (PO disetujui)', rupiah(keuangan.revenue)],
      ['Modal produk terpakai (HPP)', rupiah(keuangan.capital_used)],
      ['Laba kotor', rupiah(keuangan.gross_profit)],
      ['Biaya operasional', rupiah(keuangan.operating_expenses)],
      ['Laba bersih', rupiah(keuangan.net_profit)],
      ['Margin kotor', persen(keuangan.gross_margin_pct)],
      ['Margin bersih', persen(keuangan.net_margin_pct)],
      ['Titik impas (omzet)', keuangan.bep_revenue ? rupiah(keuangan.bep_revenue) : '—'],
      ['Titik impas (porsi)', keuangan.bep_units ? `${keuangan.bep_units} porsi` : '—'],
    ],
    theme: 'striped',
    headStyles: { fillColor: HIJAU, fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
  })

  // --- Operasional
  autoTable(doc, {
    head: [['Ringkasan Operasional', 'Nilai']],
    body: [
      ['Jumlah peserta PO', String(keuangan.participants)],
      ['PO disetujui', String(keuangan.approved_orders)],
      ['Porsi terjual', String(keuangan.units_sold)],
      ['Rata-rata nilai PO', rupiah(keuangan.avg_order_value)],
      ['PO menunggu konfirmasi', `${keuangan.pending_orders} (${rupiah(keuangan.pending_value)})`],
      ['Piutang belum dibayar', rupiah(keuangan.unpaid_value)],
    ],
    theme: 'striped',
    headStyles: { fillColor: HIJAU, fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
  })

  // --- Performa per menu
  autoTable(doc, {
    head: [['Menu', 'Modal', 'Jual', 'Terjual', 'Omzet', 'Laba', 'Serap']],
    body: performa.map((p) => [
      p.name,
      rupiah(p.cost_price),
      rupiah(p.sell_price),
      String(p.units_sold),
      rupiah(p.revenue),
      rupiah(p.gross_profit),
      persen(p.sell_through_pct, 0),
    ]),
    theme: 'grid',
    headStyles: { fillColor: HIJAU, fontSize: 9 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    margin: { left: margin, right: margin },
  })

  if (biaya.length > 0) {
    autoTable(doc, {
      head: [['Tanggal', 'Biaya Operasional', 'Kategori', 'Jumlah']],
      body: biaya.map((b) => [
        tanggal(b.incurred_at),
        b.label,
        labelKategori[b.category] ?? b.category,
        rupiah(b.amount),
      ]),
      foot: [['', '', 'Total', rupiah(keuangan.operating_expenses)]],
      theme: 'grid',
      headStyles: { fillColor: HIJAU, fontSize: 9 },
      footStyles: { fillColor: [240, 240, 242], textColor: 20, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: { 3: { halign: 'right' } },
      margin: { left: margin, right: margin },
    })
  }

  if (peserta.length > 0) {
    // Kelas & nomor HP ikut dicetak supaya panitia bisa menghubungi dari lembar ini.
    autoTable(doc, {
      head: [['Peserta', 'Kelas', 'No. HP', 'PO', 'Porsi', 'Total Belanja', 'Belum Bayar']],
      body: peserta.map((p) => [
        p.full_name ?? p.email ?? '—',
        p.class_name ?? '—',
        p.phone ?? '—',
        String(p.approved_orders),
        String(p.total_items),
        rupiah(p.total_spent),
        rupiah(p.unpaid_amount),
      ]),
      theme: 'grid',
      headStyles: { fillColor: HIJAU, fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      margin: { left: margin, right: margin },
    })
  }

  autoTable(doc, {
    head: [['Waktu', 'Pemesan', 'Kelas', 'No. HP', 'Menu', 'Qty', 'Total', 'Status', 'Bayar']],
    body: orders.map((o) => [
      tanggalJam(o.created_at),
      o.pemesan?.full_name ?? '—',
      o.pemesan?.class_name ?? '—',
      o.pemesan?.phone ?? '—',
      o.menu?.name ?? '—',
      String(o.quantity),
      rupiah(o.total_amount),
      labelStatus[o.status] ?? o.status,
      o.payment_status === 'paid' ? `Lunas${o.payment_method ? ` (${o.payment_method})` : ''}` : '—',
    ]),
    theme: 'grid',
    headStyles: { fillColor: HIJAU, fontSize: 9 },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' } },
    margin: { left: margin, right: margin },
  })

  // --- Nomor halaman
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...ABU)
    doc.text(
      `Halaman ${i} dari ${total}`,
      lebar - margin,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'right' },
    )
  }

  doc.save(`${namaBerkas(event, 'laporan-keuangan')}.pdf`)
}
