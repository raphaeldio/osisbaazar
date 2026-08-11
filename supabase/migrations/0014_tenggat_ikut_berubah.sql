-- Mengubah "batas waktu bayar" di sesi kini ikut mengubah PO yang sudah berjalan.
--
-- Sebelumnya `payment_due_at` dihitung sekali saat PO disetujui, lalu beku. Panitia yang
-- memperpanjang tenggat dari 24 jam jadi 48 jam mengira semua peserta ikut diperpanjang,
-- padahal yang berubah hanya PO yang disetujui SETELAH itu — dan PO lama tetap hangus di
-- jam ke-24. Diam-diam, tanpa peringatan.
--
-- DIHITUNG DARI `approved_at`, BUKAN DARI SEKARANG. Ini keputusan yang menentukan:
-- artinya tenggat adalah "sekian jam sejak PO disetujui", tetap konsisten untuk semua
-- orang. Kalau dihitung dari sekarang, tiap kali panitia menyentuh angka itu semua
-- peserta dapat perpanjangan penuh lagi — termasuk yang sudah menunggak dua hari.
--
-- Konsekuensi yang perlu disadari panitia: MEMPERPENDEK tenggat bisa membuat sebagian
-- PO langsung lewat batas, dan sapuan `expire_unpaid()` akan melepasnya dalam lima menit
-- berikutnya. Itu memang arti dari memperpendek, tapi peringatannya dipasang di form
-- Pengaturan supaya tidak mengagetkan.
--
-- Barisnya hanya ditulis kalau tenggatnya benar-benar berbeda — mengikuti prinsip yang
-- sama seperti 0013: jangan menyiarkan perubahan yang tidak mengubah apa pun.

create or replace function public.selaraskan_tenggat_bayar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders o
     set payment_due_at = coalesce(o.approved_at, o.created_at)
                          + make_interval(hours => new.payment_hours),
         updated_at = now()
   where o.event_id = new.id
     and o.status = 'approved'
     and o.payment_status = 'unpaid'
     and o.payment_due_at is distinct from
         coalesce(o.approved_at, o.created_at) + make_interval(hours => new.payment_hours);

  return null;
end;
$$;

revoke all on function public.selaraskan_tenggat_bayar() from public, anon, authenticated;

drop trigger if exists trg_selaraskan_tenggat_bayar on public.events;
create trigger trg_selaraskan_tenggat_bayar
  after update of payment_hours on public.events
  for each row
  when (old.payment_hours is distinct from new.payment_hours)
  execute function public.selaraskan_tenggat_bayar();

-- Supaya perubahannya sampai ke layar peserta tanpa refresh.
--
-- Kenapa lewat `events` dan bukan `orders`: Realtime menghormati RLS, dan customer
-- memang TIDAK punya policy select di `orders` — mereka tidak akan pernah menerima
-- eventnya. `events` sudah boleh dibaca semua user yang login lewat `events_select`,
-- jadi siarannya sampai. Sisi admin tetap mendengarkan `orders` seperti biasa.
do $$
begin
  begin alter publication supabase_realtime add table public.events;
  exception when duplicate_object then null; end;
end;
$$;
