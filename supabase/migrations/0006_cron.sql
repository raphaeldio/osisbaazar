-- Sapu hold kedaluwarsa tiap menit, supaya slot yang tidak jadi dikonfirmasi
-- kembali ke pool tanpa menunggu ada orang membuka aplikasi.
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('expire-po-holds');
exception when others then null;
end;
$$;

select cron.schedule('expire-po-holds', '* * * * *', $$select public.expire_holds();$$);
