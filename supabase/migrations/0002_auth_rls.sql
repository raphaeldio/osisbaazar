-- Role, trigger pendaftaran, dan Row Level Security.
--
-- Prinsip keamanan yang dipakai:
--  * `is_admin()` SECURITY DEFINER sehingga membaca profiles TIDAK memicu rekursi RLS.
--  * Customer tidak punya policy SELECT pada `menu_items` maupun `orders`. Mereka
--    membaca lewat view SECURITY DEFINER yang sudah membuang kolom HPP.
--  * Tidak ada policy INSERT pada `orders` sama sekali — PO wajib lewat reserve_slot()
--    supaya pengecekan kuota mustahil dilewati dari sisi client.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Login pertama: buat profil, tentukan role dari daftar admin_emails.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'pengguna'), '@', 1)
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    ),
    case
      when exists (
        select 1 from public.admin_emails a
        where lower(a.email) = lower(new.email)
      ) then 'admin'
      else 'customer'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Menambah email ke admin_emails langsung mempromosikan akun yang SUDAH terdaftar,
-- jadi urutan "daftar admin dulu baru login" tidak wajib.
create or replace function public.sync_admin_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set role = 'admin'
     where lower(email) = lower(new.email) and role <> 'admin';
  elsif tg_op = 'DELETE' then
    update public.profiles set role = 'customer'
     where lower(email) = lower(old.email) and role <> 'customer';
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_admin_role on public.admin_emails;
create trigger trg_sync_admin_role
  after insert or delete on public.admin_emails
  for each row execute function public.sync_admin_role();

-- ---------------------------------------------------------------- RLS

alter table public.admin_emails       enable row level security;
alter table public.profiles           enable row level security;
alter table public.events             enable row level security;
alter table public.menu_items         enable row level security;
alter table public.orders             enable row level security;
alter table public.operating_expenses enable row level security;
alter table public.notifications      enable row level security;

-- admin_emails: admin saja.
drop policy if exists admin_emails_all on public.admin_emails;
create policy admin_emails_all on public.admin_emails
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles: baca/ubah milik sendiri; admin penuh.
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Kenaikan hak akses dicegah di level KOLOM, bukan di policy: menaruh subquery
-- ke `profiles` di dalam policy `profiles` akan memicu rekursi RLS tak berujung.
-- Dengan cara ini `role` mustahil diubah dari client oleh siapa pun; satu-satunya
-- jalur perubahan role adalah trigger sync_admin_role() yang SECURITY DEFINER.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- events: semua user login boleh melihat sesi yang sudah dipublikasikan.
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated using (status <> 'draft' or public.is_admin());

drop policy if exists events_admin_write on public.events;
create policy events_admin_write on public.events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- menu_items: ADMIN SAJA. Customer membaca lewat v_menu_availability agar HPP aman.
drop policy if exists menu_items_admin_all on public.menu_items;
create policy menu_items_admin_all on public.menu_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- orders: admin baca & ubah. Customer memakai v_my_orders + RPC.
drop policy if exists orders_admin_select on public.orders;
create policy orders_admin_select on public.orders
  for select to authenticated using (public.is_admin());

drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists orders_admin_delete on public.orders;
create policy orders_admin_delete on public.orders
  for delete to authenticated using (public.is_admin());

-- operating_expenses: admin saja.
drop policy if exists expenses_admin_all on public.operating_expenses;
create policy expenses_admin_all on public.operating_expenses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- notifications: milik sendiri (tandai terbaca), admin boleh melihat semua.
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
