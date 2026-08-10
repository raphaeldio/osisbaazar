-- Penyetelan performa berdasarkan temuan database linter Supabase.

-- 1. `auth.uid()` di dalam policy dievaluasi ulang untuk SETIAP baris. Membungkusnya
--    dengan (select …) membuat Postgres menghitungnya sekali per query.
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 2. `events_admin_write` memakai FOR ALL sehingga ikut dievaluasi di jalur SELECT
--    bersama `events_select`. Dipisah agar tiap query hanya melewati satu policy.
drop policy if exists events_admin_write on public.events;

drop policy if exists events_admin_insert on public.events;
create policy events_admin_insert on public.events
  for insert to authenticated with check (public.is_admin());

drop policy if exists events_admin_update on public.events;
create policy events_admin_update on public.events
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists events_admin_delete on public.events;
create policy events_admin_delete on public.events
  for delete to authenticated using (public.is_admin());

-- 3. Foreign key tanpa indeks penutup — penting saat baris induk dihapus/di-cascade.
create index if not exists idx_notifications_order  on public.notifications (order_id);
create index if not exists idx_expenses_created_by  on public.operating_expenses (created_by);
create index if not exists idx_orders_approved_by   on public.orders (approved_by);
create index if not exists idx_slot_counters_event  on public.slot_counters (event_id);
