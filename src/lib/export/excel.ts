import ExcelJS from 'exceljs'
import { labelKategori, labelStatus, namaBerkas, unduh, type LaporanData } from './data'

const RUPIAH = '"Rp"#,##0'
const PERSEN = '0.0"%"'
const HIJAU = 'FF2EA074'

function judulKolom(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HIJAU } }
  sheet.getRow(1).alignment = { vertical: 'middle' }
  sheet.getRow(1).height = 20
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

/**
 * Workbook multi-sheet: Ringkasan · Performa Menu · Biaya · Peserta · Daftar PO.
 * Angka disimpan sebagai number (bukan teks) supaya bisa langsung dijumlahkan di Excel.
 */
export async function exportExcel(data: LaporanData) {
  const { event, keuangan, performa, biaya, peserta, orders } = data
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Bazaar OSIS'
  wb.created = new Date()

  // --- Ringkasan
  const ringkasan = wb.addWorksheet('Ringkasan')
  ringkasan.columns = [
    { header: 'Keterangan', key: 'k', width: 34 },
    { header: 'Nilai', key: 'v', width: 20 },
  ]
  judulKolom(ringkasan)

  const barisRingkasan: [string, number | string, string?][] = [
    ['Sesi bazaar', event.name],
    ['Omzet (PO disetujui)', Number(keuangan.revenue), RUPIAH],
    ['Modal produk terpakai (HPP)', Number(keuangan.capital_used), RUPIAH],
    ['Laba kotor', Number(keuangan.gross_profit), RUPIAH],
    ['Biaya operasional', Number(keuangan.operating_expenses), RUPIAH],
    ['Laba bersih', Number(keuangan.net_profit), RUPIAH],
    ['Margin kotor', Number(keuangan.gross_margin_pct), PERSEN],
    ['Margin bersih', Number(keuangan.net_margin_pct), PERSEN],
    ['Titik impas (omzet)', keuangan.bep_revenue ? Number(keuangan.bep_revenue) : '—', RUPIAH],
    ['Titik impas (porsi)', keuangan.bep_units ?? '—'],
    ['Jumlah peserta PO', Number(keuangan.participants)],
    ['PO disetujui', Number(keuangan.approved_orders)],
    ['Porsi terjual', Number(keuangan.units_sold)],
    ['Rata-rata nilai PO', Number(keuangan.avg_order_value), RUPIAH],
    ['PO menunggu konfirmasi', Number(keuangan.pending_orders)],
    ['Nilai PO menunggu', Number(keuangan.pending_value), RUPIAH],
    ['Piutang belum dibayar', Number(keuangan.unpaid_value), RUPIAH],
  ]

  for (const [k, v, fmt] of barisRingkasan) {
    const row = ringkasan.addRow({ k, v })
    if (fmt && typeof v === 'number') row.getCell('v').numFmt = fmt
  }
  ringkasan.getColumn('v').alignment = { horizontal: 'right' }

  // --- Performa menu
  const sheetMenu = wb.addWorksheet('Performa Menu')
  sheetMenu.columns = [
    { header: 'Menu', key: 'nama', width: 30 },
    { header: 'Modal (HPP)', key: 'modal', width: 14, style: { numFmt: RUPIAH } },
    { header: 'Harga jual', key: 'jual', width: 14, style: { numFmt: RUPIAH } },
    { header: 'Margin/porsi', key: 'margin', width: 14, style: { numFmt: RUPIAH } },
    { header: 'Slot', key: 'slot', width: 8 },
    { header: 'Terjual', key: 'terjual', width: 10 },
    { header: 'Sell-through', key: 'serap', width: 13, style: { numFmt: PERSEN } },
    { header: 'Omzet', key: 'omzet', width: 16, style: { numFmt: RUPIAH } },
    { header: 'Modal terpakai', key: 'modalPakai', width: 16, style: { numFmt: RUPIAH } },
    { header: 'Laba kotor', key: 'laba', width: 16, style: { numFmt: RUPIAH } },
  ]
  judulKolom(sheetMenu)
  for (const p of performa) {
    sheetMenu.addRow({
      nama: p.name,
      modal: Number(p.cost_price),
      jual: Number(p.sell_price),
      margin: Number(p.unit_margin),
      slot: p.total_slots,
      terjual: p.units_sold,
      serap: Number(p.sell_through_pct),
      omzet: Number(p.revenue),
      modalPakai: Number(p.capital_used),
      laba: Number(p.gross_profit),
    })
  }

  // --- Biaya operasional
  const sheetBiaya = wb.addWorksheet('Biaya Operasional')
  sheetBiaya.columns = [
    { header: 'Tanggal', key: 'tgl', width: 14 },
    { header: 'Keterangan', key: 'label', width: 34 },
    { header: 'Kategori', key: 'kategori', width: 14 },
    { header: 'Jumlah', key: 'jumlah', width: 16, style: { numFmt: RUPIAH } },
  ]
  judulKolom(sheetBiaya)
  for (const b of biaya) {
    sheetBiaya.addRow({
      tgl: new Date(b.incurred_at),
      label: b.label,
      kategori: labelKategori[b.category] ?? b.category,
      jumlah: Number(b.amount),
    })
  }
  sheetBiaya.getColumn('tgl').numFmt = 'dd/mm/yyyy'
  if (biaya.length > 0) {
    const total = sheetBiaya.addRow({
      kategori: 'Total',
      jumlah: Number(keuangan.operating_expenses),
    })
    total.font = { bold: true }
  }

  // --- Peserta
  const sheetPeserta = wb.addWorksheet('Peserta')
  sheetPeserta.columns = [
    { header: 'Nama', key: 'nama', width: 28 },
    { header: 'Kelas', key: 'kelas', width: 12 },
    { header: 'No. HP', key: 'hp', width: 16 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'PO disetujui', key: 'po', width: 14 },
    { header: 'PO menunggu', key: 'menunggu', width: 14 },
    { header: 'Porsi', key: 'porsi', width: 10 },
    { header: 'Total belanja', key: 'total', width: 16, style: { numFmt: RUPIAH } },
    { header: 'Belum dibayar', key: 'utang', width: 16, style: { numFmt: RUPIAH } },
  ]
  judulKolom(sheetPeserta)
  for (const p of peserta) {
    sheetPeserta.addRow({
      nama: p.full_name ?? '—',
      kelas: p.class_name ?? '—',
      // Sebagai teks, kalau tidak Excel akan membuang angka 0 di depan.
      hp: p.phone ?? '—',
      email: p.email ?? '—',
      po: p.approved_orders,
      menunggu: p.pending_orders,
      porsi: p.total_items,
      total: Number(p.total_spent),
      utang: Number(p.unpaid_amount),
    })
  }

  // --- Daftar PO
  const sheetPO = wb.addWorksheet('Daftar PO')
  sheetPO.columns = [
    { header: 'Waktu pesan', key: 'waktu', width: 20 },
    { header: 'Pemesan', key: 'pemesan', width: 26 },
    { header: 'Kelas', key: 'kelas', width: 12 },
    { header: 'No. HP', key: 'hp', width: 16 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Menu', key: 'menu', width: 28 },
    { header: 'Qty', key: 'qty', width: 8 },
    { header: 'Harga satuan', key: 'satuan', width: 15, style: { numFmt: RUPIAH } },
    { header: 'Total', key: 'total', width: 16, style: { numFmt: RUPIAH } },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Pembayaran', key: 'bayar', width: 14 },
    { header: 'Metode', key: 'metode', width: 12 },
    { header: 'Catatan', key: 'catatan', width: 30 },
  ]
  judulKolom(sheetPO)
  for (const o of orders) {
    sheetPO.addRow({
      waktu: new Date(o.created_at),
      pemesan: o.pemesan?.full_name ?? '—',
      kelas: o.pemesan?.class_name ?? '—',
      hp: o.pemesan?.phone ?? '—',
      email: o.pemesan?.email ?? '—',
      menu: o.menu?.name ?? '—',
      qty: o.quantity,
      satuan: Number(o.unit_sell_price),
      total: Number(o.total_amount),
      status: labelStatus[o.status] ?? o.status,
      bayar: o.payment_status === 'paid' ? 'Lunas' : 'Belum',
      metode: o.payment_method ?? '—',
      catatan: o.notes ?? '',
    })
  }
  sheetPO.getColumn('waktu').numFmt = 'dd/mm/yyyy hh:mm'

  const buffer = await wb.xlsx.writeBuffer()
  unduh(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${namaBerkas(event, 'laporan-keuangan')}.xlsx`,
  )
}
