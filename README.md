# Bazaar OSIS — PO & War

Platform pre-order bergaya "war" untuk bazaar OSIS. Customer login pakai akun Google,
merebut slot menu yang jumlahnya terbatas, lalu menunggu panitia memutuskan PO-nya
fix atau tidak. Selama belum disetujui, PO hanya tampil sebagai **antrian** di sisi
customer dan tidak memengaruhi angka keuangan sama sekali.

Semua tampilan dirancang **mobile-first**.

---

## Panduan pemakaian

Panduan untuk peserta dan panitia ada di [`docs/panduan.html`](docs/panduan.html) —
halaman mandiri yang bisa dibuka langsung di browser atau dibagikan linknya ke pengurus
lain. Isinya: langkah memesan, arti tiap status PO, cara menyiapkan sesi & menu, cara
membaca laporan keuangan, dan penanganan masalah umum.

## Logo organisasi

Logo diambil dari [`public/logo.png`](public/logo.png) dan dipakai di halaman login serta
sebagai favicon. Untuk menggantinya, timpa file itu — tidak ada kode yang perlu diubah.
Kalau nama atau formatnya berbeda, dua tempat yang menyebutnya: konstanta `berkas` di
[`src/components/Logo.tsx`](src/components/Logo.tsx) dan `<link rel="icon">` di
[`index.html`](index.html).

Di halaman login logonya dipasang **berpigura**: kotak membulat berpadding dengan garis
tipis, cincin pastel, dan halo lembut di belakangnya. Piguranya sengaja disiapkan lebih
dulu supaya foto apa pun yang nanti dimasukkan — persegi, bulat, berlatar putih, atau
transparan — tetap duduk rapi tanpa perlu mengedit gambarnya. Isi pigura memakai
`object-contain`, jadi logo tidak akan terpotong atau gepeng berapa pun rasionya.

Tiga animasi menyertainya, semuanya lambat dan beramplitudo kecil: pigura masuk sekali
(fade + skala), logo mengapung naik-turun 4px, dan halo berdenyut. Definisinya ada di
[`src/index.css`](src/index.css) sebagai CSS biasa, jadi `prefers-reduced-motion`
mematikannya lewat aturan global yang sudah ada. Pakai `<Logo bingkai animasi />` untuk
memasangnya di tempat lain; tanpa prop itu, `Logo` tetap gambar polos seperti sebelumnya.

## Menjalankan

```bash
npm install
```

```bash
npm run dev
```

Buka `http://localhost:5173`.

Perintah lain: `npm run build` (typecheck + build produksi), `npm run lint`, `npm run preview`.

---

## Yang masih harus kamu siapkan sendiri

Aplikasi sudah terhubung ke project Supabase `osis-bazaar`
(`txlfpyjzfnrzqmiswtxc`, region Singapura) dan seluruh skemanya sudah diterapkan.
Dua hal berikut butuh kredensial, jadi tidak bisa diotomatiskan:

### 1. Google OAuth

1. **Google Cloud Console** → *APIs & Services → Credentials* → **Create OAuth client ID**
   → tipe **Web application**.
2. Authorized redirect URI:
   `https://txlfpyjzfnrzqmiswtxc.supabase.co/auth/v1/callback`
3. Salin **Client ID** dan **Client Secret** → **Supabase Dashboard** →
   *Authentication → Sign In / Providers → Google* → aktifkan lalu tempel.
4. *Authentication → URL Configuration → Redirect URLs*: tambahkan
   `http://localhost:5173/**` (dan domain produksi nanti).

### 2. Daftarkan email admin

Di **SQL Editor** Supabase:

```sql
insert into admin_emails (email) values ('emailkamu@gmail.com');
```

Boleh dilakukan kapan saja — kalau akunnya sudah pernah login, perannya langsung
naik jadi admin lewat trigger `sync_admin_role`. Setelah punya satu admin,
sisanya bisa ditambah dari layar **Pengaturan** di dalam aplikasi.

> `.env.local` sudah terisi URL + publishable key. Publishable key memang aman
> dipublikasikan; yang tidak boleh masuk ke sana adalah `service_role` key.

---

## Data kontak peserta

Setelah login pertama, siapa pun — customer maupun panitia — diarahkan ke layar
**Lengkapi Profil** dan wajib mengisi nama lengkap, kelas, dan nomor HP sebelum bisa
memesan. Alasannya sederhana: panitia harus bisa menghubungi pemesan saat PO diproses
dan saat pesanan siap diambil.

Nomor HP dinormalkan otomatis ke bentuk baku `08xxxxxxxxx` — mau diketik `+62 812-3456-7890`,
`62812…`, atau `0812 3456 7890`, hasilnya sama. Itu membuat tombol WhatsApp di sisi admin
selalu berfungsi tanpa menebak format.

Kewajiban ini **tidak hanya dijaga di layar**. `reserve_slot()` menolak PO dari profil
yang belum lengkap, jadi memanggil endpoint langsung pun tidak bisa melewatinya.

Di halaman **Approval** dan **Peserta**, kelas muncul sebagai label dan nomor HP jadi
tombol yang langsung membuka chat WhatsApp berisi sapaan siap kirim. Keduanya juga ikut
tercetak di export PDF maupun Excel.

Data diri bisa diubah kapan saja: customer lewat tab **Profil**, panitia lewat kartu akun
di tab **Atur** — yang juga memuat tombol **Keluar**.

> Akun yang sudah terlanjur login sebelum aturan ini ada akan diminta melengkapi datanya
> saat membuka aplikasi berikutnya. PO lama tetap utuh, hanya kolom kelas & HP-nya kosong
> sampai pemiliknya mengisi.

---

## Cara kerja "war"-nya

Ini bagian paling kritis, jadi dijelaskan utuh.

**Slot baru terpakai ketika pembayaran dikonfirmasi**, bukan saat dipesan.

1. Customer menekan **Pesan Slot** → RPC `reserve_slot()`. PO dibuat `pending` dan
   **belum memakan slot sama sekali**. Yang dijaga di sini hanya dua: menolak pesanan
   ketika seluruh slot sudah terbayar, dan batas porsi per orang.
2. Panitia **Setujui** → status `approved`. Masih belum memakan slot; yang dimulai
   adalah `payment_due_at = sekarang + payment_hours` (default 24 jam, diatur per sesi).
3. Panitia menandai **Sudah bayar** → RPC `set_order_payment()` mengunci baris menu
   (`select … for update`) dan menolak kalau melewati kapasitas. **Di sinilah penjaga
   anti-oversell berada** — dipindahkan dari `reserve_slot()` karena di titik inilah
   slot benar-benar berpindah tangan.
4. Lewat tenggat dan belum dibayar → `pg_cron` menjalankan `expire_unpaid()` tiap lima
   menit: status jadi `expired`, slot kembali tersedia, pemesan dapat notifikasi.
5. Omzet, modal, dan laba tetap dihitung dari PO ber-status `approved` — yang belum
   dibayar muncul sebagai **piutang**.
6. Panitia bisa **membatalkan PO yang sudah fix** lewat `cancel_order()` — status jadi
   `cancelled`, slotnya kembali diperebutkan, dan pemesan dapat notifikasi berisi alasan.
   `payment_status` sengaja **tidak** direset: kalau uangnya sudah masuk, mengubahnya jadi
   `unpaid` akan menghapus fakta bahwa panitia berutang pengembalian. Laporan tetap aman
   karena semua agregat menyaring `status = 'approved'`.

Konsekuensi yang disadari: beberapa orang bisa memesan porsi yang sama dan yang lebih
dulu membayar yang mendapatkannya. Karena itu `v_menu_availability` mengekspos
`slots_awaiting_payment`, dan tab War menampilkan "N antre bayar" supaya persaingannya
terlihat peserta, bukan jadi kejutan.

> `events.hold_minutes` masih ada di skema tapi **tidak lagi dipakai**. Di model ini
> memesan tidak menahan apa pun, jadi hold hanya akan menghanguskan pesanan tanpa alasan.

**Tidak ada policy INSERT pada tabel `orders`.** Satu-satunya jalan membuat PO adalah
lewat `reserve_slot()`, sehingga aturan kuota mustahil dilewati dari sisi client.
Begitu pula pembayaran: hanya `set_order_payment()` yang bisa mengubahnya, dan fungsi
itu menolak panggilan dari non-admin.

---

## Keamanan data

| Aturan | Cara penegakannya |
|---|---|
| Customer tidak boleh melihat HPP | Tidak ada policy SELECT di `menu_items` maupun `orders`. Customer membaca lewat view `v_menu_availability` / `v_my_orders` yang tidak memuat kolom harga modal. |
| Customer tidak bisa jadi admin sendiri | Kolom `profiles.role` dicabut dari grant UPDATE. Satu-satunya jalur perubahan role adalah trigger `SECURITY DEFINER`. |
| Laporan keuangan hanya untuk admin | View admin memakai `security_invoker = on` + filter `where is_admin()`. |
| Anonim tidak bisa apa-apa | `revoke all on all tables in schema public from anon`, dan seluruh RPC hanya di-grant ke `authenticated`. |

Linter Supabase akan melaporkan `security_definer_view` (ERROR) untuk
`v_menu_availability`, `v_my_orders`, dan `v_leaderboard`. **Itu disengaja** —
justru itulah mekanisme yang menyembunyikan HPP dari customer.

---

## Laporan keuangan

Hanya PO berstatus `approved` yang masuk hitungan. Harga di-**snapshot** saat PO
dibuat (`unit_cost_price`, `unit_sell_price`), jadi mengubah harga menu di tengah
jalan tidak akan mengubah laba PO yang sudah lewat.

```
Omzet          = Σ (jumlah × harga jual)     ← PO disetujui saja
Modal produk   = Σ (jumlah × HPP)
Laba kotor     = Omzet − Modal produk
Laba bersih    = Laba kotor − Biaya operasional
BEP (omzet)    = Biaya operasional ÷ rasio margin kotor
BEP (porsi)    = Biaya operasional ÷ laba kotor per porsi
```

Metrik lain yang tersedia: jumlah peserta PO (user unik), rata-rata nilai PO (AOV),
persentase pembeli berulang, sell-through rate per menu, kontribusi laba per menu,
piutang (PO fix yang belum dibayar), dan tren omzet/laba harian.

**Export**: tombol PDF & Excel di halaman Keuangan. PDF berupa laporan berkop siap
lampir LPJ; Excel berisi 5 sheet (Ringkasan, Performa Menu, Biaya Operasional,
Peserta, Daftar PO) dengan angka tersimpan sebagai number sehingga bisa langsung
dijumlahkan. Kedua library-nya dimuat hanya saat tombol ditekan.

---

## Struktur

```
src/
  lib/            supabase.ts · format.ts (rupiah, tanggal ID) · query-client.ts · use-detik.ts
  lib/queries/    customer.ts · admin.ts   ← seluruh akses data + langganan realtime
  lib/export/     pdf.ts · excel.ts · data.ts
  types/          database.ts
  features/auth/  AuthProvider · guards · LoginPage · AuthCallback
  features/customer/  CustomerShell · WarPage · PesananPage · PeringkatPage · ProfilPage
  features/admin/     AdminShell · RingkasanPage · ApprovalPage · MenuPage
                      KeuanganPage · PesertaPage · PengaturanPage · event-terpilih
  components/ui/        shadcn/ui
  components/reactbits/ React Bits (CountUp · AnimatedList · SpotlightCard), disesuaikan
supabase/migrations/    0001–0011, urut dan bisa dijalankan ulang
```

Regenerate tipe setelah mengubah skema:

```bash
npx supabase gen types typescript --project-id txlfpyjzfnrzqmiswtxc > src/types/database.ts
```

---

## Catatan desain

- **Satu pintu login.** Hanya ada tombol "Masuk dengan Google". Setelah berhasil,
  `AuthProvider` membaca `profiles.role`: admin → `/admin`, selain itu → beranda war.
- **Palet pastel "tones"** — warna yang dilembutkan abu-abu: latar krem hangat, kartu
  putih, lima keluarga aksen (mawar, aprikot, mint, periwinkle, lila). Dua tingkat dipakai
  dengan sengaja: token aksi memakai versi *dusty* supaya teks tetap terbaca, sedangkan
  sapuan pastel pucatnya datang dari modifier transparansi (`bg-primary/15`). Tombol utama
  memakai pasangan `--primary-soft` (isi pastel) + `--primary-ink` (tinta gelap sewarna).
  Semua kombinasi teks sudah diukur dan lolos ambang kontras 4,5:1 — pastel murni pada
  teks kecil jatuh di bawah ambang itu, jadi angkanya dicek, bukan dikira-kira.
- **Animasi sengaja minim.** Satu pola saja: fade + geser 8px selama 220ms, plus
  CountUp pada angka saldo. `prefers-reduced-motion` mematikan semuanya.
- **Code splitting.** Dashboard admin dan library export dimuat terpisah, supaya
  customer tidak ikut mengunduhnya.
- Sesi contoh **"Bazaar OSIS 2026"** beserta 5 menu sudah diisikan sebagai titik
  awal. Hapus atau ubah lewat halaman Pengaturan dan Menu.
