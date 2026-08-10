-- Menghentikan siaran realtime yang tidak membawa informasi.
--
-- Masalahnya begini. Trigger ini menulis ulang baris `slot_counters` setiap kali ada
-- perubahan di `orders`, lengkap dengan `updated_at = now()`. Karena `updated_at`
-- selalu berubah, barisnya selalu dianggap berubah, sehingga Realtime menyiarkannya —
-- dan SETIAP peserta yang sedang membuka tab War langsung menembak ulang
-- v_menu_availability.
--
-- Sejak aturan slot-berbasis-pembayaran (0010), PO baru berstatus 'pending' TIDAK
-- mengubah `slots_taken` sama sekali. Jadi selama war — saat semua PO masuk sebagai
-- pending — setiap siaran itu isinya persis sama dengan sebelumnya. Murni beban.
--
-- Bebannya naik kuadrat, bukan lurus:
--
--     400 PO dalam 2 menit x 900 peserta terhubung
--     = 360.000 permintaan / 120 detik ~ 3.000 permintaan per detik
--
-- Perbaikannya satu klausa: hanya tulis kalau angkanya benar-benar berubah. Baris yang
-- tidak jadi ditulis tidak masuk WAL, jadi tidak ada yang disiarkan.
--
-- Yang perlu disadari sebagai konsekuensi: angka "N antre bayar" di tab War tidak lagi
-- berubah seketika, melainkan ikut penyegaran biasa. Yang benar-benar penting terlihat
-- langsung adalah SISA SLOT — dan itu justru tetap seketika, karena sisa slot hanya
-- berubah ketika panitia menandai lunas, dan di situlah `slots_taken` berubah.
--
-- `updated_at` tidak dibaca aplikasi mana pun; ia hanya penanda perubahan.

create or replace function public.refresh_slot_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_menu  uuid := coalesce(new.menu_item_id, old.menu_item_id);
  v_event uuid := coalesce(new.event_id, old.event_id);
  v_taken int;
begin
  select coalesce(sum(o.quantity), 0)::int into v_taken
    from public.orders o
   where o.menu_item_id = v_menu
     and o.status = 'approved'
     and o.payment_status = 'paid';

  insert into public.slot_counters (menu_item_id, event_id, slots_taken, updated_at)
  values (v_menu, v_event, v_taken, now())
  on conflict (menu_item_id)
    do update set slots_taken = excluded.slots_taken, updated_at = now()
    -- Inti perbaikannya. Tanpa baris ini, setiap PO pending menyiarkan angka yang
    -- sama ke seluruh peserta.
    where slot_counters.slots_taken is distinct from excluded.slots_taken;

  return null;
end;
$$;

revoke all on function public.refresh_slot_counter() from public, anon, authenticated;
