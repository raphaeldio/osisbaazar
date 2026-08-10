-- ATURAN BARU: slot baru terpakai ketika panitia menandai PO sudah dibayar.
--
-- Dua akibat yang perlu diketahui sebelum membaca kodenya:
--
-- 1. Penjaga anti-oversell PINDAH TEMPAT. Dulu berada di reserve_slot() — mengunci
--    baris menu saat pemesanan. Sekarang di set_order_payment(), karena di situlah
--    slot benar-benar berpindah tangan. Menandai lunas melebihi kapasitas ditolak.
--
-- 2. Hold 15 menit pada PO pending DIMATIKAN. Di model ini memesan tidak menahan
--    apa pun, jadi hold hanya akan menghanguskan pesanan tanpa alasan. Urgensinya
--    dipindah ke tenggat pembayaran setelah PO disetujui (events.payment_hours).
--
-- Konsekuensi yang disadari dan diterima: beberapa orang bisa memesan porsi yang
-- sama, dan yang lebih dulu membayar yang mendapatkannya. Karena itu view
-- v_menu_availability menambahkan slots_awaiting_payment supaya peserta melihat
-- berapa banyak yang sedang mengantre membayar.

alter table public.events
  add column if not exists payment_hours int not null default 24;

do $$
begin
  alter table public.events
    add constraint events_payment_hours_range check (payment_hours between 1 and 720);
exception when duplicate_object then null;
end;
$$;

alter table public.orders
  add column if not exists payment_due_at timestamptz;

create index if not exists idx_orders_payment_sweep
  on public.orders (payment_due_at)
  where status = 'approved' and payment_status = 'unpaid';

-- Counter realtime kini hanya menghitung porsi yang sudah lunas.
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
    do update set slots_taken = excluded.slots_taken, updated_at = now();

  return null;
end;
$$;

revoke all on function public.refresh_slot_counter() from public, anon, authenticated;

-- Memesan tidak lagi memakan slot dan tidak lagi memasang hold.
-- Yang tetap dijaga: menolak pesanan baru ketika seluruh slot sudah terbayar, dan
-- batas porsi per orang supaya antrean tidak bisa dibanjiri satu orang.
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
  v_paid     int;
  v_mine     int;
  v_order_id uuid;
begin
  if v_user is null then
    raise exception 'Kamu harus masuk dulu untuk memesan.' using errcode = '28000';
  end if;

  if not public.profil_lengkap(v_user) then
    raise exception 'Lengkapi nama, kelas, dan nomor HP dulu supaya panitia bisa menghubungimu.'
      using errcode = 'P0001';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Jumlah pesanan minimal 1.' using errcode = '22023';
  end if;

  select * into v_item from public.menu_items where id = p_menu_item_id;
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

  select coalesce(sum(quantity), 0) into v_paid
    from public.orders
   where menu_item_id = p_menu_item_id
     and status = 'approved'
     and payment_status = 'paid';

  if v_paid >= v_item.total_slots then
    raise exception 'Slot menu ini sudah habis terbayar.' using errcode = 'P0001';
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
    v_item.cost_price, v_item.sell_price, 'pending', null,
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_order_id;

  return v_order_id;
end;
$$;

-- Menyetujui belum memakan slot; yang dimulai adalah tenggat pembayaran.
create or replace function public.approve_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item  public.menu_items%rowtype;
  v_event public.events%rowtype;
  v_paid  int;
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

  select * into v_item  from public.menu_items where id = v_order.menu_item_id;
  select * into v_event from public.events     where id = v_order.event_id;

  select coalesce(sum(quantity), 0) into v_paid
    from public.orders
   where menu_item_id = v_order.menu_item_id
     and status = 'approved'
     and payment_status = 'paid';

  if v_paid + v_order.quantity > v_item.total_slots then
    raise exception 'Tidak bisa disetujui: sisa slot yang belum terbayar tinggal %.',
      greatest(v_item.total_slots - v_paid, 0) using errcode = 'P0001';
  end if;

  update public.orders
     set status = 'approved',
         approved_at = now(),
         approved_by = auth.uid(),
         hold_expires_at = null,
         rejection_reason = null,
         payment_due_at = case
           when payment_status = 'paid' then null
           else now() + make_interval(hours => v_event.payment_hours)
         end,
         updated_at = now()
   where id = p_order_id;

  insert into public.notifications (user_id, type, title, body, order_id)
  values (v_order.user_id, 'approved', 'PO kamu disetujui',
          format('%s x%s disetujui. Slotmu baru terkunci setelah pembayaran dikonfirmasi panitia — mohon bayar dalam %s jam.',
                 v_item.name, v_order.quantity, v_event.payment_hours),
          p_order_id);
end;
$$;

-- DI SINILAH penjaga anti-oversell sekarang berada.
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
declare
  v_order public.orders%rowtype;
  v_item  public.menu_items%rowtype;
  v_paid  int;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh mengubah status pembayaran.' using errcode = '42501';
  end if;

  if p_payment_status not in ('paid', 'unpaid') then
    raise exception 'Status pembayaran tidak dikenal.' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'P0002';
  end if;

  if p_payment_status = 'paid' then
    -- Kunci baris menu: dua panitia yang menandai lunas bersamaan akan diantre,
    -- sehingga jumlah porsi terbayar tidak mungkin melewati kapasitas.
    select * into v_item from public.menu_items where id = v_order.menu_item_id for update;

    select coalesce(sum(quantity), 0) into v_paid
      from public.orders
     where menu_item_id = v_order.menu_item_id
       and status = 'approved'
       and payment_status = 'paid'
       and id <> p_order_id;

    if v_paid + v_order.quantity > v_item.total_slots then
      raise exception 'Tidak bisa ditandai lunas: sisa slot tinggal % porsi.',
        greatest(v_item.total_slots - v_paid, 0) using errcode = 'P0001';
    end if;
  end if;

  update public.orders
     set payment_status = p_payment_status,
         payment_method = case when p_payment_status = 'paid' then p_payment_method else null end,
         -- Lunas menghentikan hitungan tenggat; membatalkan lunas memulainya lagi.
         payment_due_at = case
           when p_payment_status = 'paid' then null
           when status = 'approved' then now() + make_interval(
             hours => (select payment_hours from public.events where id = v_order.event_id))
           else null
         end,
         updated_at = now()
   where id = p_order_id;
end;
$$;

-- Sapuan tenggat bayar menggantikan sapuan hold.
create or replace function public.expire_unpaid()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with dilepas as (
    update public.orders
       set status = 'expired',
           payment_due_at = null,
           rejection_reason = 'Batas waktu pembayaran terlewat.',
           updated_at = now()
     where status = 'approved'
       and payment_status = 'unpaid'
       and payment_due_at is not null
       and payment_due_at < now()
    returning id, user_id
  ), diberitahu as (
    insert into public.notifications (user_id, type, title, body, order_id)
    select d.user_id, 'expired', 'PO dibatalkan karena belum dibayar',
           'Batas waktu pembayaran terlewat, jadi pesananmu dilepas. Silakan pesan lagi kalau slotnya masih ada.',
           d.id
      from dilepas d
    returning 1
  )
  select count(*) into v_count from dilepas;

  return v_count;
end;
$$;

revoke all on function public.expire_unpaid() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('expire-po-holds');
exception when others then null;
end;
$$;

do $$
begin
  perform cron.unschedule('expire-po-unpaid');
exception when others then null;
end;
$$;

select cron.schedule('expire-po-unpaid', '*/5 * * * *', $$select public.expire_unpaid();$$);

-- ---------------------------------------------------------------- View

-- slots_taken sekarang berarti "porsi yang sudah dibayar".
-- slots_awaiting_payment ditambahkan supaya peserta tahu berapa banyak yang sedang
-- mengantre membayar untuk slot yang sama — tanpa itu, sisa slot yang terlihat besar
-- akan terasa menipu ketika pesanannya ternyata tidak kebagian.
create or replace view public.v_menu_availability
with (security_invoker = off) as
select
  m.id,
  m.event_id,
  e.name   as event_name,
  e.status as event_status,
  e.closes_at,
  m.name,
  m.description,
  m.image_url,
  m.sell_price,
  m.total_slots,
  m.max_per_user,
  m.is_active,
  m.sort_order,
  coalesce(t.paid, 0)::int as slots_taken,
  greatest(m.total_slots - coalesce(t.paid, 0), 0)::int as slots_left,
  coalesce(t.antre, 0)::int as slots_awaiting_payment
from public.menu_items m
join public.events e on e.id = m.event_id
left join lateral (
  select
    sum(o.quantity) filter (where o.status = 'approved' and o.payment_status = 'paid')::int as paid,
    sum(o.quantity) filter (
      where o.status = 'pending'
         or (o.status = 'approved' and o.payment_status = 'unpaid')
    )::int as antre
  from public.orders o
  where o.menu_item_id = m.id
) t on true
where e.status <> 'draft' or public.is_admin();

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
  o.payment_due_at
from public.orders o
join public.menu_items m on m.id = o.menu_item_id
join public.events e on e.id = o.event_id
where o.user_id = auth.uid();

grant select on public.v_menu_availability to authenticated;
grant select on public.v_my_orders         to authenticated;

-- PO yang sudah disetujui SEBELUM aturan ini ada tidak punya payment_due_at,
-- sehingga tidak pernah tersapu dan tidak menampilkan hitung mundur — menggantung
-- selamanya. Diberi jendela penuh terhitung sekarang, bukan langsung dihanguskan.
update public.orders o
   set payment_due_at = now() + make_interval(
         hours => (select e.payment_hours from public.events e where e.id = o.event_id)),
       updated_at = now()
 where o.status = 'approved'
   and o.payment_status = 'unpaid'
   and o.payment_due_at is null;

-- Selaraskan counter dengan aturan baru.
update public.slot_counters c
   set slots_taken = coalesce((
         select sum(o.quantity)::int from public.orders o
          where o.menu_item_id = c.menu_item_id
            and o.status = 'approved' and o.payment_status = 'paid'
       ), 0),
       updated_at = now();
