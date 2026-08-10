-- Tujuan pembayaran ditampilkan ke peserta.
--
-- Ditaruh di `events`, bukan di konstanta kode, karena rekening panitia bisa
-- berganti tiap sesi bazaar — dan mengubahnya lewat halaman Pengaturan jauh lebih
-- masuk akal daripada menunggu deploy ulang.
--
-- Soal keamanan: kolom ini memang terbaca semua user yang sudah login, lewat policy
-- `events_select` yang sudah ada. Itu disengaja — nomor rekening tujuan transfer
-- memang harus terlihat pemesan. Yang tetap tertutup adalah HPP dan identitas
-- peserta lain. Menulisnya tetap admin saja (`events_admin_write`).

alter table public.events
  add column if not exists payment_bank    text,
  add column if not exists payment_account text,
  add column if not exists payment_holder  text,
  add column if not exists payment_contact text;

comment on column public.events.payment_bank    is 'Nama bank atau e-wallet, mis. BCA / DANA.';
comment on column public.events.payment_account is 'Nomor rekening atau nomor e-wallet tujuan transfer.';
comment on column public.events.payment_holder  is 'Nama pemilik rekening, untuk dicocokkan peserta sebelum mengirim.';
comment on column public.events.payment_contact is 'Nomor HP panitia untuk konfirmasi & kirim bukti transfer.';

-- Ikut dibawa di v_my_orders supaya tujuan bayar tetap terbaca peserta walaupun
-- sesinya sudah ditutup — justru di situlah tagihan yang belum lunas menumpuk.
create or replace view public.v_my_orders
with (security_invoker = off) as
select
  o.id, o.menu_item_id, o.event_id,
  m.name as menu_name, m.image_url,
  e.name as event_name,
  o.quantity, o.unit_sell_price, o.total_amount,
  o.status, o.payment_status, o.payment_method,
  o.notes, o.rejection_reason,
  o.hold_expires_at, o.approved_at, o.created_at,
  o.payment_due_at,
  e.payment_bank,
  e.payment_account,
  e.payment_holder,
  e.payment_contact
from public.orders o
join public.menu_items m on m.id = o.menu_item_id
join public.events e on e.id = o.event_id
where o.user_id = auth.uid();

grant select on public.v_my_orders to authenticated;
