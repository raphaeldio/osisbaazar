-- View pelaporan.
--
-- Tiga view pertama SENGAJA SECURITY DEFINER (security_invoker = off). Itulah
-- mekanismenya: customer sama sekali tidak punya akses ke tabel `menu_items` dan
-- `orders`, dan view inilah satu-satunya jendela — sudah dibersihkan dari kolom HPP.
-- Linter Supabase akan menandainya sebagai ERROR `security_definer_view`; itu
-- disengaja, bukan kelalaian.
--
-- Empat view admin memakai security_invoker = on + filter `where is_admin()`,
-- karena RLS admin sudah cukup dan tidak perlu menembus izin.

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
  coalesce(t.taken, 0)::int as slots_taken,
  greatest(m.total_slots - coalesce(t.taken, 0), 0)::int as slots_left
from public.menu_items m
join public.events e on e.id = m.event_id
left join lateral (
  -- Hold yang sudah lewat waktu tidak ikut dihitung, walau pg_cron belum menyapunya.
  select sum(o.quantity)::int as taken
  from public.orders o
  where o.menu_item_id = m.id
    and (
      o.status = 'approved'
      or (o.status = 'pending'
          and (o.hold_expires_at is null or o.hold_expires_at > now()))
    )
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
  o.hold_expires_at, o.approved_at, o.created_at
from public.orders o
join public.menu_items m on m.id = o.menu_item_id
join public.events e on e.id = o.event_id
where o.user_id = auth.uid();

create or replace view public.v_leaderboard
with (security_invoker = off) as
select
  p.id as user_id,
  p.full_name,
  p.avatar_url,
  coalesce(sum(o.total_amount), 0)::numeric(14, 2) as total_spent,
  count(*)::int                                    as order_count,
  coalesce(sum(o.quantity), 0)::int                as total_items,
  rank() over (order by coalesce(sum(o.total_amount), 0) desc)::int as rank
from public.orders o
join public.profiles p on p.id = o.user_id
where o.status = 'approved'
group by p.id, p.full_name, p.avatar_url;

create or replace view public.v_menu_performance
with (security_invoker = on) as
select
  m.id as menu_item_id, m.event_id, m.name,
  m.cost_price, m.sell_price, m.total_slots, m.is_active,
  (m.sell_price - m.cost_price)::numeric(12, 2) as unit_margin,
  case when m.sell_price > 0
       then round((m.sell_price - m.cost_price) / m.sell_price * 100, 1)
       else 0 end as unit_margin_pct,
  coalesce(a.units_sold, 0)::int         as units_sold,
  coalesce(a.revenue, 0)::numeric(14, 2) as revenue,
  coalesce(a.cost, 0)::numeric(14, 2)    as capital_used,
  (coalesce(a.revenue, 0) - coalesce(a.cost, 0))::numeric(14, 2) as gross_profit,
  coalesce(pnd.pending_units, 0)::int    as pending_units,
  case when m.total_slots > 0
       then round(coalesce(a.units_sold, 0)::numeric / m.total_slots * 100, 1)
       else 0 end as sell_through_pct
from public.menu_items m
left join lateral (
  select sum(o.quantity)::int as units_sold, sum(o.total_amount) as revenue, sum(o.total_cost) as cost
  from public.orders o where o.menu_item_id = m.id and o.status = 'approved'
) a on true
left join lateral (
  select sum(o.quantity)::int as pending_units
  from public.orders o
  where o.menu_item_id = m.id and o.status = 'pending'
    and (o.hold_expires_at is null or o.hold_expires_at > now())
) pnd on true
where public.is_admin();

create or replace view public.v_event_financials
with (security_invoker = on) as
select
  e.id as event_id, e.name as event_name, e.status,
  e.hold_minutes, e.opens_at, e.closes_at,
  coalesce(a.revenue, 0)::numeric(14, 2)      as revenue,
  coalesce(a.capital_used, 0)::numeric(14, 2) as capital_used,
  (coalesce(a.revenue, 0) - coalesce(a.capital_used, 0))::numeric(14, 2) as gross_profit,
  coalesce(x.expenses, 0)::numeric(14, 2)     as operating_expenses,
  (coalesce(a.revenue, 0) - coalesce(a.capital_used, 0) - coalesce(x.expenses, 0))::numeric(14, 2) as net_profit,
  case when coalesce(a.revenue, 0) > 0
       then round((coalesce(a.revenue, 0) - coalesce(a.capital_used, 0)) / a.revenue * 100, 1)
       else 0 end as gross_margin_pct,
  case when coalesce(a.revenue, 0) > 0
       then round((coalesce(a.revenue, 0) - coalesce(a.capital_used, 0) - coalesce(x.expenses, 0)) / a.revenue * 100, 1)
       else 0 end as net_margin_pct,
  coalesce(a.participants, 0)::int    as participants,
  coalesce(a.approved_orders, 0)::int as approved_orders,
  coalesce(a.units_sold, 0)::int      as units_sold,
  case when coalesce(a.approved_orders, 0) > 0
       then round(a.revenue / a.approved_orders) else 0 end::numeric(14, 2) as avg_order_value,
  coalesce(pnd.pending_orders, 0)::int           as pending_orders,
  coalesce(pnd.pending_value, 0)::numeric(14, 2) as pending_value,
  coalesce(up.unpaid_value, 0)::numeric(14, 2)   as unpaid_value,
  -- Titik impas: berapa porsi & berapa omzet lagi (pada margin berjalan) untuk
  -- menutup seluruh biaya operasional.
  case when coalesce(a.units_sold, 0) > 0 and (a.revenue - a.capital_used) > 0
       then ceil(coalesce(x.expenses, 0) / ((a.revenue - a.capital_used) / a.units_sold))::int
       else null end as bep_units,
  case when coalesce(a.revenue, 0) > 0 and (a.revenue - a.capital_used) > 0
       then round(coalesce(x.expenses, 0) / ((a.revenue - a.capital_used) / a.revenue))
       else null end::numeric(14, 2) as bep_revenue
from public.events e
left join lateral (
  select sum(o.total_amount) as revenue, sum(o.total_cost) as capital_used,
         sum(o.quantity)::int as units_sold, count(*)::int as approved_orders,
         count(distinct o.user_id)::int as participants
  from public.orders o where o.event_id = e.id and o.status = 'approved'
) a on true
left join lateral (
  select count(*)::int as pending_orders, sum(o.total_amount) as pending_value
  from public.orders o
  where o.event_id = e.id and o.status = 'pending'
    and (o.hold_expires_at is null or o.hold_expires_at > now())
) pnd on true
left join lateral (
  select sum(o.total_amount) as unpaid_value
  from public.orders o
  where o.event_id = e.id and o.status = 'approved' and o.payment_status = 'unpaid'
) up on true
left join lateral (
  select sum(x2.amount) as expenses
  from public.operating_expenses x2 where x2.event_id = e.id
) x on true
where public.is_admin();

create or replace view public.v_participants
with (security_invoker = on) as
select
  p.id as user_id, p.full_name, p.email, p.avatar_url, o.event_id,
  count(*) filter (where o.status = 'approved')::int as approved_orders,
  count(*) filter (where o.status = 'pending')::int  as pending_orders,
  coalesce(sum(o.total_amount) filter (where o.status = 'approved'), 0)::numeric(14, 2) as total_spent,
  coalesce(sum(o.quantity)     filter (where o.status = 'approved'), 0)::int            as total_items,
  coalesce(sum(o.total_amount) filter (where o.status = 'approved' and o.payment_status = 'unpaid'), 0)::numeric(14, 2) as unpaid_amount,
  max(o.created_at) as last_order_at
from public.orders o
join public.profiles p on p.id = o.user_id
where public.is_admin()
group by p.id, p.full_name, p.email, p.avatar_url, o.event_id;

create or replace view public.v_daily_finance
with (security_invoker = on) as
select
  o.event_id,
  ((o.approved_at at time zone 'Asia/Jakarta')::date)  as day,
  sum(o.total_amount)::numeric(14, 2)                  as revenue,
  sum(o.total_cost)::numeric(14, 2)                    as capital_used,
  sum(o.total_amount - o.total_cost)::numeric(14, 2)   as gross_profit,
  count(*)::int                                        as orders,
  sum(o.quantity)::int                                 as units_sold
from public.orders o
where o.status = 'approved' and o.approved_at is not null and public.is_admin()
group by 1, 2;

grant select on public.v_menu_availability to authenticated;
grant select on public.v_my_orders         to authenticated;
grant select on public.v_leaderboard       to authenticated;
grant select on public.v_menu_performance  to authenticated;
grant select on public.v_event_financials  to authenticated;
grant select on public.v_participants      to authenticated;
grant select on public.v_daily_finance     to authenticated;
