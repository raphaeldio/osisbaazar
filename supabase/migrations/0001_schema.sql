-- Skema inti Bazaar OSIS.
--
-- Catatan desain penting:
-- 1. Harga di `orders` di-SNAPSHOT (unit_cost_price / unit_sell_price). Kalau admin
--    mengubah harga menu di tengah jalan, laba PO lama tidak ikut berubah.
-- 2. `orders.event_id` sengaja didenormalisasi supaya laporan keuangan per event
--    tidak perlu join berlapis.
-- 3. HPP (cost_price) TIDAK BOLEH terlihat customer. Karena itu customer tidak
--    pernah membaca tabel `menu_items` / `orders` langsung — hanya lewat view.

create table if not exists public.admin_emails (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  avatar_url text,
  role       text not null default 'customer' check (role in ('admin', 'customer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  status       text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  -- Berapa lama slot ditahan untuk seorang user sebelum dilepas otomatis.
  hold_minutes int  not null default 15 check (hold_minutes between 1 and 1440),
  opens_at     timestamptz,
  closes_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  name        text not null,
  description text,
  image_url   text,
  cost_price  numeric(12, 2) not null default 0 check (cost_price >= 0),   -- HPP / modal per unit
  sell_price  numeric(12, 2) not null default 0 check (sell_price >= 0),   -- harga jual per unit
  total_slots int  not null default 0 check (total_slots >= 0),
  max_per_user int not null default 0 check (max_per_user >= 0),           -- 0 = tanpa batas
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  menu_item_id     uuid not null references public.menu_items (id) on delete restrict,
  event_id         uuid not null references public.events (id) on delete cascade,
  quantity         int  not null check (quantity > 0),
  unit_cost_price  numeric(12, 2) not null default 0,
  unit_sell_price  numeric(12, 2) not null default 0,
  total_amount     numeric(14, 2) generated always as (quantity * unit_sell_price) stored,
  total_cost       numeric(14, 2) generated always as (quantity * unit_cost_price) stored,
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  payment_status   text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  payment_method   text check (payment_method in ('tunai', 'transfer', 'qris', 'ewallet')),
  notes            text,
  rejection_reason text,
  hold_expires_at  timestamptz,
  approved_at      timestamptz,
  approved_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.operating_expenses (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  label       text not null,
  category    text not null default 'lainnya'
                check (category in ('transport', 'kemasan', 'sewa', 'promosi', 'peralatan', 'lainnya')),
  amount      numeric(14, 2) not null check (amount >= 0),
  incurred_at date not null default current_date,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null default 'info' check (type in ('info', 'approved', 'rejected', 'expired')),
  title      text not null,
  body       text,
  order_id   uuid references public.orders (id) on delete cascade,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Indeks yang benar-benar dipakai jalur panas: hitung slot, antrian admin, sweep hold.
create index if not exists idx_menu_items_event      on public.menu_items (event_id, sort_order);
create index if not exists idx_orders_menu_status    on public.orders (menu_item_id, status);
create index if not exists idx_orders_user           on public.orders (user_id, created_at desc);
create index if not exists idx_orders_event_status   on public.orders (event_id, status);
create index if not exists idx_orders_hold_sweep     on public.orders (hold_expires_at) where status = 'pending';
create index if not exists idx_notifications_unread  on public.notifications (user_id, created_at desc);
create index if not exists idx_expenses_event        on public.operating_expenses (event_id, incurred_at);

-- updated_at otomatis
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'events', 'menu_items', 'orders'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$I', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$I
         for each row execute function public.touch_updated_at()', t);
  end loop;
end;
$$;
