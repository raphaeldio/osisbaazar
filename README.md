# Bazaar OSIS: PO dan "War"

**Platform pre-order bergaya war untuk bazaar OSIS: peserta merebut slot menu yang terbatas, panitia menyetujui dan mengonfirmasi pembayaran, dan slot tidak pernah terjual melebihi kapasitas.**

[Coba demo langsung](https://osisbaazar.vercel.app) | [Panduan pemakaian](docs/panduan.html)

Semua tampilan dirancang **mobile-first**.

---

## Masalah yang diselesaikan

Pre-order bazaar sekolah biasanya dikelola lewat chat dan spreadsheet: pesanan tercecer, slot terjual dua kali, dan panitia menagih pembayaran satu per satu. Aplikasi ini memindahkan alurnya ke satu tempat:

1. Peserta login dengan Google dan memesan slot menu (**PO**).
2. Panitia **menyetujui** PO, lalu menandai **sudah bayar**.
3. Slot baru terpakai saat pembayaran dikonfirmasi, sehingga pesanan yang tidak dibayar tidak menahan slot orang lain.
4. Laporan keuangan (omzet, laba, titik impas) tersedia otomatis.

## Fitur

**Untuk peserta**
- Login Google dan profil wajib (nama, kelas, nomor HP) sebelum bisa memesan.
- Tab **War** dengan sisa slot dan jumlah antrean bayar, **PO Saya** dengan hitung mundur tenggat bayar, **Peringkat**, dan **Profil**.
- Info rekening tujuan transfer dengan nomor yang bisa disalin sekali ketuk dan tombol WhatsApp ke panitia.

**Untuk panitia**
- **Approval** dikelompokkan per pemesan, memuat total belanja dan jumlah yang belum dibayar, sehingga satu orang berarti satu tagihan.
- Kelola menu, sesi, peserta, dan pengaturan (tenggat bayar, rekening, biaya operasional).
- **Keuangan**: omzet, modal, laba kotor dan bersih, BEP, piutang, sell-through per menu, dan tren harian. Ekspor **PDF** (laporan berkop untuk LPJ) dan **Excel** (5 sheet).

## Cara kerja "war"

Ini bagian paling kritis: **slot terpakai saat pembayaran dikonfirmasi, bukan saat dipesan.**

| Langkah | Yang terjadi |
| --- | --- |
| Peserta menekan **Pesan Slot** | `reserve_slot()` membuat PO berstatus `pending`. Belum memakan slot. Hanya menolak jika seluruh slot sudah terbayar atau melewati batas porsi per orang. |
| Panitia **Setujui** | Status `approved`, tenggat bayar mulai berjalan (`payment_hours`, default 24 jam, diatur per sesi). |
| Panitia menandai **Sudah bayar** | `set_order_payment()` mengunci baris menu (`select ... for update`) dan menolak bila melewati kapasitas. **Di sinilah penjaga anti-oversell berada.** |
| Lewat tenggat, belum bayar | `pg_cron` menjalankan `expire_unpaid()` tiap 5 menit: status `expired`, slot kembali tersedia, pemesan dapat notifikasi. |
| Panitia membatalkan PO yang sudah fix | `cancel_order()`: slot kembali diperebutkan. `payment_status` sengaja tidak direset agar fakta utang pengembalian tidak hilang. |

Konsekuensi yang disadari: beberapa orang bisa memesan porsi yang sama, dan yang lebih dulu **membayar** yang mendapatkannya. Karena itu tab War menampilkan "N antre bayar" supaya persaingan terlihat.

Tidak ada policy INSERT pada tabel `orders`. Satu-satunya jalan membuat PO adalah `reserve_slot()`, sehingga aturan kuota mustahil dilewati dari sisi client.

## Bertahan saat war ramai

Beban aplikasi war tidak naik lurus terhadap jumlah peserta, melainkan **kuadrat**: satu PO memicu satu siaran realtime, dan satu siaran diterima semua peserta yang membuka tab War. Perkiraan untuk 900 peserta dan 400 PO dalam dua menit adalah 360.000 permintaan (sekitar 3.000 per detik). Tiga rem dipasang:

1. **Siaran tanpa informasi tidak dikirim.** Trigger `refresh_slot_counter()` hanya menulis bila `slots_taken` benar-benar berubah. Karena PO `pending` tidak memakai slot, badai PO saat war tidak menyiarkan apa pun. Diperkirakan memangkas beban puncak lebih dari 90%.
2. **Siaran beruntun digabung dan waktunya diacak** ([`src/lib/siaran.ts`](src/lib/siaran.ts)). Polanya "yang pertama menjadwalkan, sisanya menumpang", bukan debounce yang terus di-reset, karena saat war siaran nyaris tak putus dan debounce akan membuat layar tidak pernah ter-update. Jeda diberi komponen acak 700-1500 ms agar 900 klien tidak menghantam dalam satu detak.
3. **`staleTime` 30 detik** sebagai batas atas beban dari peserta yang bolak-balik ke WhatsApp.

Perubahan yang datanya sudah ada di siaran (misalnya tenggat bayar baru) dihitung ulang langsung dari cache tanpa permintaan jaringan.

Batasan yang tidak bisa diperbaiki dari kode: plan Free Supabase membatasi koneksi Realtime bersamaan (sekitar 200). Untuk 900 peserta serentak, naikkan plan sehari sebelum acara lalu turunkan lagi.

## Keamanan data

| Aturan | Cara penegakannya |
| --- | --- |
| Customer tidak boleh melihat harga modal | Tidak ada policy SELECT di `menu_items` dan `orders`. Customer membaca lewat view `v_menu_availability` dan `v_my_orders` yang tidak memuat kolom harga modal. |
| Customer tidak bisa menjadi admin sendiri | Kolom `profiles.role` dicabut dari grant UPDATE. Perubahan role hanya lewat trigger `SECURITY DEFINER`. |
| Laporan keuangan hanya untuk admin | View admin memakai `security_invoker = on` dan filter `where is_admin()`. |
| Anonim tidak bisa apa-apa | `revoke all on all tables in schema public from anon`; seluruh RPC hanya di-grant ke `authenticated`. |

Linter Supabase akan melaporkan `security_definer_view` untuk `v_menu_availability`, `v_my_orders`, dan `v_leaderboard`. **Itu disengaja**: justru itulah mekanisme yang menyembunyikan harga modal dari customer.

## Laporan keuangan

Hanya PO berstatus `approved` yang dihitung. Harga di-**snapshot** saat PO dibuat, sehingga mengubah harga menu tidak mengubah laba PO yang sudah lewat.

```
Omzet          = jumlah x harga jual            (PO disetujui saja)
Modal produk   = jumlah x HPP
Laba kotor     = Omzet - Modal produk
Laba bersih    = Laba kotor - Biaya operasional
BEP (omzet)    = Biaya operasional / rasio margin kotor
BEP (porsi)    = Biaya operasional / laba kotor per porsi
```

PO yang sudah fix tetapi belum dibayar muncul sebagai **piutang**.

## Stack

React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Supabase (PostgreSQL, Auth Google, Realtime, pg_cron), Vercel. Library ekspor PDF dan Excel dimuat hanya saat tombol ditekan (code splitting).

## Struktur

```
src/
  lib/             supabase.ts, format.ts (rupiah, tanggal), query-client.ts, siaran.ts
  lib/queries/     customer.ts, admin.ts  (seluruh akses data dan langganan realtime)
  lib/export/      pdf.ts, excel.ts, data.ts
  features/auth/   AuthProvider, guards, LoginPage, AuthCallback
  features/customer/  War, Pesanan, Peringkat, Profil
  features/admin/     Ringkasan, Approval, Menu, Keuangan, Peserta, Pengaturan
  components/ui/      shadcn/ui
supabase/migrations/  0001-0013, berurutan dan bisa dijalankan ulang
docs/panduan.html     panduan peserta dan panitia
```

## Menjalankan secara lokal

Prasyarat: Node.js 18+ dan sebuah project Supabase.

```bash
git clone https://github.com/raphaeldio/osisbaazar
cd osisbaazar
npm install
cp .env.example .env.local     # isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Buka <http://localhost:5173>. Perintah lain: `npm run build` (typecheck dan build produksi), `npm run lint`, `npm run preview`.

Gunakan hanya **publishable key**. Jangan pernah memasukkan `service_role` key ke repo atau variabel `VITE_*`.

### Setup Supabase (sekali saja)

1. Terapkan migrasi di `supabase/migrations/` secara berurutan.
2. Aktifkan **Google OAuth**: buat OAuth client (Web application) di Google Cloud Console dengan redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, lalu tempel Client ID dan Secret di *Authentication > Sign In / Providers > Google*.
3. Tambahkan `http://localhost:5173/**` (dan domain produksi nanti) di *Authentication > URL Configuration > Redirect URLs*.
4. Daftarkan email admin di SQL Editor: `insert into admin_emails (email) values ('emailkamu@gmail.com');`. Setelah punya satu admin, sisanya bisa ditambah dari layar Pengaturan.

## Deploy ke Vercel

Tiga hal yang harus benar. Bila salah satunya terlewat, gejalanya **layar putih** atau login yang macet, bukan pesan error yang jelas.

1. **Environment variables.** Vercel tidak membaca `.env.local`. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` di *Project > Settings > Environment Variables*, lalu **Redeploy** (nilainya dibaca saat build). Tanpa ini, `src/lib/supabase.ts` sengaja melempar error saat dimuat dan React tidak sempat merender apa pun.
2. **`vercel.json` (rewrite SPA).** Sudah ada di repo. Tanpa rewrite ke `index.html`, rute seperti `/auth/callback` menjadi 404 dan login Google patah di langkah terakhir.
3. **Daftarkan domain produksi di Supabase.** Isi *Site URL* dan *Redirect URLs* (`https://NAMA-PROYEK.vercel.app/**`). Redirect URI di Google Cloud Console tidak perlu diubah.

## Catatan desain

- **Satu pintu login**: hanya tombol "Masuk dengan Google". Setelah berhasil, admin diarahkan ke `/admin`, yang lain ke beranda war.
- **Palet pastel** dengan kontras teks yang diukur (lolos ambang 4,5:1), bukan dikira-kira.
- **Animasi minim**: satu pola fade dan geser 8px selama 220 ms, dimatikan oleh `prefers-reduced-motion`.
- Nomor HP dinormalkan otomatis ke `08xxxxxxxxx`, sehingga tombol WhatsApp admin selalu berfungsi.
