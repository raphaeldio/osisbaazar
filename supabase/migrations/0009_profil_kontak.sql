-- Panitia perlu bisa menghubungi pemesan, jadi nama lengkap, kelas, dan nomor HP
-- wajib diisi sebelum seseorang boleh mengamankan slot.

alter table public.profiles
  add column if not exists class_name text,
  add column if not exists phone      text;

-- Nomor disimpan dalam bentuk baku 08xxxxxxxxx (frontend menormalkan +62 → 0),
-- supaya link WhatsApp di sisi admin tidak perlu menebak format.
do $$
begin
  alter table public.profiles
    add constraint profiles_phone_format
    check (phone is null or phone ~ '^0[0-9]{8,13}$');
exception when duplicate_object then null;
end;
$$;

-- Kolom yang boleh diubah sendiri oleh pemiliknya. `role` tetap di luar daftar ini
-- supaya kenaikan hak akses tidak mungkin dilakukan dari client.
grant update (full_name, avatar_url, class_name, phone) on public.profiles to authenticated;

create or replace function public.profil_lengkap(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and btrim(coalesce(p.full_name, ''))  <> ''
      and btrim(coalesce(p.class_name, '')) <> ''
      and btrim(coalesce(p.phone, ''))      <> ''
  );
$$;

revoke all on function public.profil_lengkap(uuid) from public, anon;
grant execute on function public.profil_lengkap(uuid) to authenticated;

-- Gerbang profil ditegakkan DI DALAM RPC, bukan hanya di layar. Gerbang frontend
-- bisa dilewati dengan memanggil endpoint langsung, dan panitia akan menerima PO
-- tanpa kontak. Sisa isi fungsi ini sama persis dengan 0003_rpc.sql.
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

  if not public.profil_lengkap(v_user) then
    raise exception 'Lengkapi nama, kelas, dan nomor HP dulu supaya panitia bisa menghubungimu.'
      using errcode = 'P0001';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Jumlah pesanan minimal 1.' using errcode = '22023';
  end if;

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

revoke all on function public.reserve_slot(uuid, int, text) from public, anon;
grant execute on function public.reserve_slot(uuid, int, text) to authenticated;

-- Kelas & nomor HP ikut di daftar peserta supaya panitia bisa langsung menghubungi.
-- Harus DROP dulu: create or replace tidak bisa menyisipkan kolom di tengah view.
drop view if exists public.v_participants;

create view public.v_participants
with (security_invoker = on) as
select
  p.id as user_id, p.full_name, p.email, p.avatar_url,
  p.class_name, p.phone,
  o.event_id,
  count(*) filter (where o.status = 'approved')::int as approved_orders,
  count(*) filter (where o.status = 'pending')::int  as pending_orders,
  coalesce(sum(o.total_amount) filter (where o.status = 'approved'), 0)::numeric(14, 2) as total_spent,
  coalesce(sum(o.quantity)     filter (where o.status = 'approved'), 0)::int            as total_items,
  coalesce(sum(o.total_amount) filter (where o.status = 'approved' and o.payment_status = 'unpaid'), 0)::numeric(14, 2) as unpaid_amount,
  max(o.created_at) as last_order_at
from public.orders o
join public.profiles p on p.id = o.user_id
where public.is_admin()
group by p.id, p.full_name, p.email, p.avatar_url, p.class_name, p.phone, o.event_id;

grant select on public.v_participants to authenticated;
