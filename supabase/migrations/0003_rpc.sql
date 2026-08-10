-- RPC. Semua penulisan `orders` lewat sini, tidak ada satupun policy INSERT
-- langsung, sehingga aturan kuota tidak bisa dilewati dari client.

-- Melepas hold yang sudah lewat waktu. Dipanggil pg_cron tiap menit DAN dipanggil
-- defensif di dalam reserve_slot(), supaya tetap benar walau cron belum aktif.
create or replace function public.expire_holds()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with released as (
    update public.orders
       set status = 'expired', hold_expires_at = null, updated_at = now()
     where status = 'pending'
       and hold_expires_at is not null
       and hold_expires_at < now()
    returning id, user_id, menu_item_id
  ), notified as (
    insert into public.notifications (user_id, type, title, body, order_id)
    select r.user_id, 'expired', 'Slot dilepas',
           'Batas waktu konfirmasi habis sebelum PO kamu disetujui, jadi slotnya dikembalikan.',
           r.id
      from released r
    returning 1
  )
  select count(*) into v_count from released;

  return v_count;
end;
$$;

-- Inti mekanisme "war".
create or replace function public.reserve_slot(
  p_menu_item_id uuid,
  p_quantity     int  default 1,
  p_notes        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_item     public.menu_items%rowtype;
  v_event    public.events%rowtype;
  v_taken    int;
  v_mine     int;
  v_order_id uuid;
begin
  if v_user is null then
    raise exception 'Kamu harus masuk dulu untuk mengamankan slot.' using errcode = '28000';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Jumlah pesanan minimal 1.' using errcode = '22023';
  end if;

  -- Kunci baris menu. Inilah yang mencegah dua orang merebut slot terakhir
  -- secara bersamaan: request kedua menunggu sampai request pertama selesai.
  select * into v_item from public.menu_items where id = p_menu_item_id for update;
  if not found then
    raise exception 'Menu tidak ditemukan.' using errcode = 'P0002';
  end if;

  if not v_item.is_active then
    raise exception 'Menu ini sedang tidak tersedia.' using errcode = 'P0001';
  end if;

  select * into v_event from public.events where id = v_item.event_id;
  if v_event.status <> 'open' then
    raise exception 'Sesi PO belum dibuka.' using errcode = 'P0001';
  end if;
  if v_event.closes_at is not null and now() > v_event.closes_at then
    raise exception 'Sesi PO sudah ditutup.' using errcode = 'P0001';
  end if;
  if v_event.opens_at is not null and now() < v_event.opens_at then
    raise exception 'Sesi PO belum dimulai.' using errcode = 'P0001';
  end if;

  -- Lepas dulu hold kedaluwarsa pada menu ini, baru hitung sisa slot.
  update public.orders
     set status = 'expired', hold_expires_at = null, updated_at = now()
   where menu_item_id = p_menu_item_id
     and status = 'pending'
     and hold_expires_at is not null
     and hold_expires_at < now();

  select coalesce(sum(quantity), 0) into v_taken
    from public.orders
   where menu_item_id = p_menu_item_id
     and status in ('pending', 'approved');

  if v_taken + p_quantity > v_item.total_slots then
    raise exception 'Slot tidak cukup. Sisa % slot.', greatest(v_item.total_slots - v_taken, 0)
      using errcode = 'P0001';
  end if;

  if v_item.max_per_user > 0 then
    select coalesce(sum(quantity), 0) into v_mine
      from public.orders
     where menu_item_id = p_menu_item_id
       and user_id = v_user
       and status in ('pending', 'approved');

    if v_mine + p_quantity > v_item.max_per_user then
      raise exception 'Maksimal % porsi per orang untuk menu ini.', v_item.max_per_user
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.orders (
    user_id, menu_item_id, event_id, quantity,
    unit_cost_price, unit_sell_price, status, hold_expires_at, notes
  )
  values (
    v_user, p_menu_item_id, v_item.event_id, p_quantity,
    v_item.cost_price, v_item.sell_price, 'pending',
    now() + make_interval(mins => v_event.hold_minutes),
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_order_id;

  return v_order_id;
end;
$$;

-- Customer membatalkan PO-nya sendiri selagi masih menunggu; slot langsung kembali.
create or replace function public.cancel_my_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  update public.orders
     set status = 'cancelled', hold_expires_at = null, updated_at = now()
   where id = p_order_id
     and user_id = auth.uid()
     and status = 'pending';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'PO tidak ditemukan atau sudah tidak bisa dibatalkan.' using errcode = 'P0001';
  end if;
end;
$$;

-- Admin menyetujui PO. Kapasitas dicek ULANG karena PO yang sudah expired/rejected
-- juga boleh dihidupkan lagi dari sini, dan itu berpotensi melebihi kuota.
create or replace function public.approve_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item  public.menu_items%rowtype;
  v_taken int;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh menyetujui PO.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_order.status = 'approved' then
    return;
  end if;

  select * into v_item from public.menu_items where id = v_order.menu_item_id for update;

  select coalesce(sum(quantity), 0) into v_taken
    from public.orders
   where menu_item_id = v_order.menu_item_id
     and status in ('pending', 'approved')
     and id <> p_order_id;

  if v_taken + v_order.quantity > v_item.total_slots then
    raise exception 'Tidak bisa disetujui: slot menu sudah penuh (sisa %).',
      greatest(v_item.total_slots - v_taken, 0) using errcode = 'P0001';
  end if;

  update public.orders
     set status = 'approved',
         approved_at = now(),
         approved_by = auth.uid(),
         hold_expires_at = null,
         rejection_reason = null,
         updated_at = now()
   where id = p_order_id;

  insert into public.notifications (user_id, type, title, body, order_id)
  values (v_order.user_id, 'approved', 'PO kamu disetujui',
          format('%s x%s sudah fix. Sampai jumpa di bazaar!', v_item.name, v_order.quantity),
          p_order_id);
end;
$$;

create or replace function public.reject_order(p_order_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_name  text;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh menolak PO.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'P0002';
  end if;

  update public.orders
     set status = 'rejected',
         rejection_reason = nullif(btrim(coalesce(p_reason, '')), ''),
         hold_expires_at = null,
         approved_at = null,
         approved_by = auth.uid(),
         updated_at = now()
   where id = p_order_id;

  select name into v_name from public.menu_items where id = v_order.menu_item_id;

  insert into public.notifications (user_id, type, title, body, order_id)
  values (v_order.user_id, 'rejected', 'PO kamu ditolak',
          coalesce(nullif(btrim(coalesce(p_reason, '')), ''),
                   format('PO %s tidak bisa diproses kali ini.', v_name)),
          p_order_id);
end;
$$;

create or replace function public.set_order_payment(
  p_order_id       uuid,
  p_payment_status text,
  p_payment_method text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh mengubah status pembayaran.' using errcode = '42501';
  end if;

  update public.orders
     set payment_status = p_payment_status,
         payment_method = case when p_payment_status = 'paid' then p_payment_method else null end,
         updated_at = now()
   where id = p_order_id;
end;
$$;

create or replace function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
     set read_at = now()
   where user_id = auth.uid() and read_at is null;
$$;

-- Hanya fungsi yang memang untuk dipanggil client yang diekspos.
revoke all on function public.expire_holds() from public, anon, authenticated;
grant execute on function public.reserve_slot(uuid, int, text)          to authenticated;
grant execute on function public.cancel_my_order(uuid)                  to authenticated;
grant execute on function public.approve_order(uuid)                    to authenticated;
grant execute on function public.reject_order(uuid, text)               to authenticated;
grant execute on function public.set_order_payment(uuid, text, text)    to authenticated;
grant execute on function public.mark_notifications_read()              to authenticated;
