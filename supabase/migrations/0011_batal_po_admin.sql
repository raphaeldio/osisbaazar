-- Panitia boleh membatalkan PO yang sudah fix.
--
-- Kenapa fungsi baru dan bukan reject_order: menolak adalah keputusan awal atas PO
-- yang masih mengantre, sedangkan membatalkan terjadi setelah PO disetujui — bahkan
-- setelah dibayar. Keduanya perlu jejak dan kalimat notifikasi yang berbeda, jadi
-- dibedakan supaya riwayatnya tetap jujur dibaca.
--
-- Slot otomatis kembali tersedia: sejak migrasi 0010, porsi terpakai dihitung dari
-- PO ber-status 'approved' DAN 'paid'. Begitu status berubah jadi 'cancelled',
-- baris itu keluar dari hitungan dan trigger refresh_slot_counter menyiarkan
-- angka barunya ke semua peserta.
--
-- payment_status SENGAJA tidak diubah. Kalau uangnya memang sudah masuk, mencatat
-- ulang jadi 'unpaid' akan menghapus fakta bahwa panitia berutang pengembalian.
-- Laporan keuangan tetap aman karena semua agregatnya menyaring status = 'approved'.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('info', 'approved', 'rejected', 'expired', 'cancelled'));

create or replace function public.cancel_order(p_order_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  public.orders%rowtype;
  v_name   text;
  v_alasan text := nullif(btrim(coalesce(p_reason, '')), '');
  v_body   text;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh membatalkan PO.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_order.status = 'cancelled' then
    return;
  end if;

  select name into v_name from public.menu_items where id = v_order.menu_item_id;

  update public.orders
     set status           = 'cancelled',
         rejection_reason = coalesce(v_alasan, 'Dibatalkan panitia.'),
         payment_due_at   = null,
         hold_expires_at  = null,
         updated_at       = now()
   where id = p_order_id;

  v_body := btrim(
    format('%s x%s dibatalkan panitia.%s%s',
           coalesce(v_name, 'PO'),
           v_order.quantity,
           case when v_order.payment_status = 'paid'
                then ' Pembayaranmu perlu dikembalikan — hubungi panitia kalau belum diterima.'
                else '' end,
           case when v_alasan is not null then ' Alasan: ' || v_alasan else '' end));

  insert into public.notifications (user_id, type, title, body, order_id)
  values (v_order.user_id, 'cancelled', 'PO kamu dibatalkan panitia', v_body, p_order_id);
end;
$$;

revoke all on function public.cancel_order(uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid, text) to authenticated;
