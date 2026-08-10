-- Pengetatan izin.
--
-- Postgres memberi EXECUTE kepada PUBLIC untuk setiap fungsi baru. Tanpa dicabut,
-- semua RPC di atas bisa dipanggil pengunjung anonim lewat /rest/v1/rpc/*.

-- search_path yang bisa diubah role adalah celah privilege escalation.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Fungsi trigger tidak boleh muncul sebagai endpoint REST sama sekali.
revoke all on function public.handle_new_user()      from public, anon, authenticated;
revoke all on function public.sync_admin_role()      from public, anon, authenticated;
revoke all on function public.refresh_slot_counter() from public, anon, authenticated;
revoke all on function public.seed_slot_counter()    from public, anon, authenticated;
revoke all on function public.touch_updated_at()     from public, anon, authenticated;

-- expire_holds() hanya untuk pg_cron (berjalan sebagai superuser), bukan client.
revoke all on function public.expire_holds() from public, anon, authenticated;

revoke all on function public.is_admin()                             from public, anon;
revoke all on function public.reserve_slot(uuid, int, text)          from public, anon;
revoke all on function public.cancel_my_order(uuid)                  from public, anon;
revoke all on function public.approve_order(uuid)                    from public, anon;
revoke all on function public.reject_order(uuid, text)               from public, anon;
revoke all on function public.set_order_payment(uuid, text, text)    from public, anon;
revoke all on function public.mark_notifications_read()              from public, anon;

grant execute on function public.is_admin()                          to authenticated;
grant execute on function public.reserve_slot(uuid, int, text)       to authenticated;
grant execute on function public.cancel_my_order(uuid)               to authenticated;
grant execute on function public.approve_order(uuid)                 to authenticated;
grant execute on function public.reject_order(uuid, text)            to authenticated;
grant execute on function public.set_order_payment(uuid, text, text) to authenticated;
grant execute on function public.mark_notifications_read()           to authenticated;

-- Tidak ada satupun tabel yang boleh terbaca tanpa login.
revoke all on all tables in schema public from anon;
