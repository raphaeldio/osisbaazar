-- Sinyal realtime untuk sisa slot.
--
-- Realtime menghormati RLS. Customer TIDAK punya policy select di `orders`, jadi
-- mereka tidak akan pernah menerima event dari tabel itu. Solusinya: tabel counter
-- ringan yang aman dibaca siapa saja (tanpa HPP, tanpa identitas pemesan), diisi
-- trigger. Tabel ini dipakai sebagai SINYAL; angka otoritatif tetap dari
-- v_menu_availability yang ikut memperhitungkan hold kedaluwarsa.

create table if not exists public.slot_counters (
  menu_item_id uuid primary key references public.menu_items (id) on delete cascade,
  event_id     uuid not null references public.events (id) on delete cascade,
  slots_taken  int not null default 0,
  updated_at   timestamptz not null default now()
);

alter table public.slot_counters enable row level security;

drop policy if exists slot_counters_read on public.slot_counters;
create policy slot_counters_read on public.slot_counters
  for select to authenticated using (true);

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
     and (
       o.status = 'approved'
       or (o.status = 'pending' and (o.hold_expires_at is null or o.hold_expires_at > now()))
     );

  insert into public.slot_counters (menu_item_id, event_id, slots_taken, updated_at)
  values (v_menu, v_event, v_taken, now())
  on conflict (menu_item_id)
    do update set slots_taken = excluded.slots_taken, updated_at = now();

  return null;
end;
$$;

drop trigger if exists trg_refresh_slot_counter on public.orders;
create trigger trg_refresh_slot_counter
  after insert or update or delete on public.orders
  for each row execute function public.refresh_slot_counter();

-- Menu baru langsung punya baris counter agar UI tidak perlu menangani null.
create or replace function public.seed_slot_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.slot_counters (menu_item_id, event_id, slots_taken)
  values (new.id, new.event_id, 0)
  on conflict (menu_item_id) do nothing;
  return null;
end;
$$;

drop trigger if exists trg_seed_slot_counter on public.menu_items;
create trigger trg_seed_slot_counter
  after insert on public.menu_items
  for each row execute function public.seed_slot_counter();

insert into public.slot_counters (menu_item_id, event_id, slots_taken)
select m.id, m.event_id, 0 from public.menu_items m
on conflict (menu_item_id) do nothing;

do $$
begin
  begin alter publication supabase_realtime add table public.slot_counters;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then null; end;
end;
$$;
