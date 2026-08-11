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

## Deploy ke Vercel

Tiga hal yang harus benar. Kalau salah satunya terlewat, gejalanya **layar putih polos**
atau login yang mentok — bukan pesan error yang menjelaskan dirinya sendiri, jadi
daftar ini ada di sini.

### 1. Environment variables

Vercel **tidak** membaca `.env.local` — file itu memang tidak ikut ke repo. Isi manual di
*Project → Settings → Environment Variables*, centang ketiga environment
(Production, Preview, Development):

```
VITE_SUPABASE_URL=https://txlfpyjzfnrzqmiswtxc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_Ejx1BehmHIks-7RWCdvfpw_6_Kny6kC
```

Nilainya dibaca saat **build**, bukan saat halaman dibuka — jadi setelah menambahkannya
harus **Redeploy**; menyegarkan browser saja tidak akan mengubah apa pun.

Tanpa ini `src/lib/supabase.ts` sengaja melempar error saat modul dimuat, dan React tidak
sempat merender apa pun. Itulah layar putihnya. Buktinya selalu ada di Console browser.

### 2. `vercel.json` — rewrite SPA

Sudah ada di repo. Aplikasi ini memakai `BrowserRouter`, jadi URL seperti `/masuk` dan
`/auth/callback` tidak punya file fisik di server. Tanpa rewrite ke `index.html`, Vercel
menjawabnya dengan 404 miliknya sendiri — dan yang paling fatal, **login Google patah di
langkah terakhir** karena Google memulangkan pengguna tepat ke `/auth/callback`.

### 3. Daftarkan domain produksi di Supabase

*Authentication → URL Configuration*:

- **Site URL**: `https://NAMA-PROYEK.vercel.app`
- **Redirect URLs**: tambahkan `https://NAMA-PROYEK.vercel.app/**`
  (biarkan `http://localhost:5173/**` tetap ada supaya pengembangan lokal jalan)

Yang **tidak** perlu diubah adalah Google Cloud Console: redirect URI di sana tetap
menunjuk `https://txlfpyjzfnrzqmiswtxc.supabase.co/auth/v1/callback`, karena Google selalu
memulangkan ke Supabase dulu, baru Supabase ke aplikasimu.

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
6. **Tujuan transfer** (bank, nomor rekening, atas nama, nomor HP panitia) disimpan per
   sesi di `events` dan diisi lewat halaman **Pengaturan** — bukan di kode, karena
   rekening panitia bisa berganti tiap sesi. Peserta melihatnya di layar **PO Saya**
   begitu ada PO yang disetujui tapi belum dibayar: nomor rekening bisa disalin sekali
   ketuk, dan nomor panitia jadi tombol WhatsApp berisi sapaan siap kirim. Kolomnya ikut
   dibawa `v_my_orders`, jadi tujuan bayar tetap terbaca walau sesinya sudah ditutup —
   justru di situlah tagihan yang belum lunas menumpuk. Kosongkan semuanya kalau bazaar
   hanya menerima tunai; kartunya otomatis tidak muncul.
7. Panitia bisa **membatalkan PO yang sudah fix** lewat `cancel_order()` — status jadi
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

## Bertahan saat war ramai

Bagian ini ada karena beban aplikasi war tidak naik lurus terhadap jumlah peserta —
kalau tidak dijaga, ia naik **kuadrat**. Satu PO masuk memicu satu siaran realtime, dan
satu siaran diterima *semua* peserta yang sedang membuka tab War. Dengan 900 peserta,
400 PO dalam dua menit pernah berarti 360.000 permintaan (~3.000 per detik) — jauh di
atas kemampuan compute mana pun yang masuk akal untuk bazaar sekolah.

Tiga rem dipasang, dan ketiganya bekerja di lapisan berbeda:

**1. Siaran yang tidak membawa informasi tidak dikirim** (`0013_hemat_siaran_slot.sql`).
Trigger `refresh_slot_counter()` hanya menulis kalau `slots_taken` benar-benar berubah:

```sql
on conflict (menu_item_id) do update set ...
  where slot_counters.slots_taken is distinct from excluded.slots_taken
```

Karena PO `pending` tidak memakai slot, seluruh badai PO saat war kini **tidak
menyiarkan apa pun**. Siaran hanya terjadi saat panitia menandai lunas — puluhan kali,
bukan ratusan per menit. Ini sendirian memangkas beban puncak lebih dari 90%.

**2. Siaran yang beruntun digabung, dan waktunya diacak** ([`src/lib/siaran.ts`](src/lib/siaran.ts)).
Sepuluh siaran dalam dua detik jadi satu penyegaran. Yang sama pentingnya: jedanya diberi
komponen acak 700–1500 ms, karena siaran diterima semua peserta pada milidetik yang sama —
tanpa pengacakan, 900 permintaan akan menghantam dalam satu detak.

Polanya sengaja **"yang pertama menjadwalkan, sisanya menumpang"**, bukan debounce yang
me-reset hitungan. Debounce berbahaya di sini: saat war siarannya nyaris tak putus,
hitungannya akan terus di-reset dan layar peserta justru tidak pernah ter-update.

**3. `staleTime` 30 detik** ([`src/lib/query-client.ts`](src/lib/query-client.ts)).
`refetchOnWindowFocus` menghormati `staleTime`, jadi angka ini adalah batas atas beban
dari peserta yang bolak-balik ke WhatsApp lalu kembali.

Konsekuensi yang disadari: angka **"N antre bayar"** tidak lagi berubah seketika,
melainkan ikut penyegaran biasa. **Sisa slot tetap seketika** — dan itu yang penting,
karena sisa slot hanya berubah ketika pembayaran dikonfirmasi.

Yang **tidak** bisa diperbaiki dari kode: plan Free membatasi koneksi Realtime bersamaan
(sekitar 200). Di atas itu, peserta ke-201 dan seterusnya tidak menerima siaran sama
sekali. Untuk 900 peserta serentak, naikkan plan sehari sebelum acara lalu turunkan lagi.

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
supabase/migrations/    0001–0013, urut dan bisa dijalankan ulang
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
- **Approval dikelompokkan per pemesan**, bukan daftar PO datar
  ([`src/lib/kelompok.ts`](src/lib/kelompok.ts)). Peserta sering memesan beberapa kali
  terpisah, dan tanpa pengelompokan panitia harus mengingat sendiri bahwa dua baris
  berjauhan adalah orang yang sama — lalu menagihnya dua kali. Kartu kelompok memuat
  total belanja dan **berapa yang belum dibayar**, jadi satu orang = satu tagihan dan
  satu percakapan WhatsApp. Pengelompokan dilakukan *setelah* penyaringan tab, supaya
  angka di tab "Menunggu" hanya bicara soal PO yang menunggu.
- **Animasi sengaja minim.** Satu pola saja: fade + geser 8px selama 220ms, plus
  CountUp pada angka saldo. `prefers-reduced-motion` mematikan semuanya.
- **Code splitting.** Dashboard admin dan library export dimuat terpisah, supaya
  customer tidak ikut mengunduhnya.
- Sesi contoh **"Bazaar OSIS 2026"** beserta 5 menu sudah diisikan sebagai titik
  awal. Hapus atau ubah lewat halaman Pengaturan dan Menu.
