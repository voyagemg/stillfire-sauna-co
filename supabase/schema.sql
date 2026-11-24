-- Stillfire Sauna Co. booking backend (Supabase / Postgres)
-- One sauna, rented by the night. Customers request dates; the owner approves.
-- Nothing in "public" is readable by visitors directly: the website only calls
-- the functions at the bottom of this file.

create schema if not exists app;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------- settings
create table app.config (
  id boolean primary key default true check (id),
  mailer_url text,                                   -- set after the email function is deployed
  mailer_secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
insert into app.config default values;

create table public.settings (
  id boolean primary key default true check (id),
  base_town text,
  contact_email text,
  contact_phone text,
  owner_notify_email text,
  copy_email text,                                   -- gets a separate copy of every automatic email
  first_night_price numeric(10,2),
  additional_night_price numeric(10,2),
  free_delivery_miles int,
  per_mile_fee numeric(10,2),
  max_delivery_miles int,
  damage_deposit numeric(10,2),
  firewood_bundle_price numeric(10,2),
  seats int,
  min_notice_days int not null default 2 check (min_notice_days between 0 and 60),
  max_nights int not null default 14 check (max_nights between 1 and 60),
  delivery_time text,
  pickup_time text,
  site_url text,
  review_url text,
  calendar_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  updated_at timestamptz not null default now()
);
insert into public.settings (base_town, first_night_price, additional_night_price, free_delivery_miles, per_mile_fee, damage_deposit, firewood_bundle_price)
values ('Perham', 300, 250, 30, 2.50, 250, 15);

create table public.admins (
  email text primary key,
  added_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- bookings
create type public.booking_status as enum ('pending', 'approved', 'declined', 'cancelled', 'completed');

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('SF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  status public.booking_status not null default 'pending',
  delivery_date date not null,
  pickup_date date not null,
  nights int generated always as (pickup_date - delivery_date) stored,
  customer_name text not null,
  email text not null,
  phone text not null,
  address_line text not null,
  city text not null,
  state text not null default 'MN',
  zip text not null,
  miles_from_base int,
  occasion text,
  guest_count int,
  firewood_bundles int not null default 0,
  site_confirmed boolean not null default false,
  notes text,
  estimate numeric(10,2),
  quoted_total numeric(10,2),
  owner_note text,
  source_ip text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint bookings_dates_valid check (pickup_date > delivery_date),
  -- THE double-booking guard. The database itself refuses two live bookings
  -- whose dates touch, no matter how the rows are written.
  constraint bookings_no_overlap exclude using gist (
    daterange(delivery_date, pickup_date, '[]') with &&
  ) where (status in ('pending', 'approved'))
);
create index bookings_status_delivery_idx on public.bookings (status, delivery_date);
create index bookings_email_idx on public.bookings (lower(email));

create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint blocked_dates_valid check (end_date >= start_date)
);

create table public.waivers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  role text not null check (role in ('renter', 'guest')),
  signer_name text not null,
  signer_email text,
  signature_text text not null,
  minors text,
  statements jsonb not null default '[]'::jsonb,
  waiver_version text not null,
  waiver_sha256 text,
  waiver_text text,
  ip text,
  user_agent text,
  signed_at timestamptz not null default now()
);
create index waivers_booking_idx on public.waivers (booking_id);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  handled boolean not null default false,
  followup_queued_at timestamptz,
  source_ip text,
  created_at timestamptz not null default now()
);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  template text not null,
  to_email text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  send_after timestamptz not null default now(),
  claimed_at timestamptz,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_queue_idx on public.email_outbox (status, send_after);

-- ---------------------------------------------------------------- access rules
create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant usage on schema app to authenticated;
revoke all on all tables in schema app from public, anon, authenticated;
revoke all on function app.is_admin() from public;
grant execute on function app.is_admin() to authenticated;

alter table public.settings enable row level security;
alter table public.admins enable row level security;
alter table public.bookings enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.waivers enable row level security;
alter table public.inquiries enable row level security;
alter table public.email_outbox enable row level security;

revoke all on public.settings, public.admins, public.bookings, public.blocked_dates,
  public.waivers, public.inquiries, public.email_outbox from anon, authenticated;
grant select, update on public.settings to authenticated;
grant select on public.admins to authenticated;
grant select, insert, update on public.bookings to authenticated;
grant select, insert, update, delete on public.blocked_dates to authenticated;
grant select on public.waivers to authenticated;
grant select, update on public.inquiries to authenticated;
grant select on public.email_outbox to authenticated;

create policy settings_admin_read on public.settings for select to authenticated using ((select app.is_admin()));
create policy settings_admin_write on public.settings for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy admins_admin_read on public.admins for select to authenticated using ((select app.is_admin()));
create policy bookings_admin_read on public.bookings for select to authenticated using ((select app.is_admin()));
create policy bookings_admin_insert on public.bookings for insert to authenticated with check ((select app.is_admin()));
create policy bookings_admin_update on public.bookings for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy blocks_admin_read on public.blocked_dates for select to authenticated using ((select app.is_admin()));
create policy blocks_admin_insert on public.blocked_dates for insert to authenticated with check ((select app.is_admin()));
create policy blocks_admin_update on public.blocked_dates for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy blocks_admin_delete on public.blocked_dates for delete to authenticated using ((select app.is_admin()));
create policy waivers_admin_read on public.waivers for select to authenticated using ((select app.is_admin()));
create policy inquiries_admin_read on public.inquiries for select to authenticated using ((select app.is_admin()));
create policy inquiries_admin_update on public.inquiries for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy outbox_admin_read on public.email_outbox for select to authenticated using ((select app.is_admin()));

-- ---------------------------------------------------------------- helpers
create or replace function app.today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Chicago')::date;
$$;

create or replace function app.client_ip() returns text
language plpgsql stable set search_path = '' as $$
declare h text;
begin
  h := current_setting('request.headers', true);
  if h is null or h = '' then return null; end if;
  return nullif(trim(split_part(h::jsonb ->> 'x-forwarded-for', ',', 1)), '');
exception when others then
  return null;
end $$;

create or replace function app.biz() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'base_town', s.base_town, 'contact_email', s.contact_email, 'contact_phone', s.contact_phone,
    'delivery_time', s.delivery_time, 'pickup_time', s.pickup_time, 'site_url', s.site_url,
    'review_url', s.review_url, 'damage_deposit', s.damage_deposit)
  from public.settings s;
$$;

create or replace function app.booking_payload(b public.bookings) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ref', b.ref, 'name', b.customer_name, 'email', b.email, 'phone', b.phone,
    'delivery_date', b.delivery_date, 'pickup_date', b.pickup_date, 'nights', b.nights,
    'address', b.address_line || ', ' || b.city || ', ' || b.state || ' ' || b.zip,
    'miles_from_base', b.miles_from_base, 'occasion', b.occasion, 'guest_count', b.guest_count,
    'firewood_bundles', b.firewood_bundles, 'notes', b.notes,
    'estimate', b.estimate, 'quoted_total', b.quoted_total, 'owner_note', b.owner_note,
    'biz', app.biz());
$$;

create or replace function app.queue_email(p_template text, p_to text, p_payload jsonb, p_dedupe text default null, p_send_after timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
declare v_copy text;
begin
  if p_to is null or trim(p_to) = '' then return; end if;
  insert into public.email_outbox (template, to_email, payload, dedupe_key, send_after)
  values (p_template, trim(p_to), coalesce(p_payload, '{}'::jsonb), p_dedupe, p_send_after)
  on conflict (dedupe_key) do nothing;
  select nullif(trim(copy_email), '') into v_copy from public.settings;
  if v_copy is not null and lower(v_copy) <> lower(trim(p_to)) then
    insert into public.email_outbox (template, to_email, payload, dedupe_key, send_after)
    values (p_template, v_copy, coalesce(p_payload, '{}'::jsonb), case when p_dedupe is null then null else p_dedupe || ':copy' end, p_send_after)
    on conflict (dedupe_key) do nothing;
  end if;
end $$;

-- Wakes the email function. Never allowed to break a booking if it fails.
create or replace function app.kick_mailer() returns void
language plpgsql security definer set search_path = '' as $$
declare c app.config;
begin
  select * into c from app.config;
  if c.mailer_url is null or c.mailer_url = '' then return; end if;
  perform net.http_post(
    url := c.mailer_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-stillfire-key', c.mailer_secret)
  );
exception when others then
  raise warning 'kick_mailer failed: %', sqlerrm;
end $$;

create or replace function app.kick_mailer_if_pending() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.email_outbox where status in ('pending', 'sending') and send_after <= now() and attempts < 5) then
    perform app.kick_mailer();
  end if;
end $$;

-- ---------------------------------------------------------------- triggers
-- Bookings may not sit on dates the owner blocked, and blocks may not sit on live bookings.
create or replace function app.bookings_check_blocks() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('pending', 'approved') and exists (
    select 1 from public.blocked_dates d
    where daterange(d.start_date, d.end_date, '[]') && daterange(new.delivery_date, new.pickup_date, '[]')
  ) then
    raise exception 'DATES_BLOCKED';
  end if;
  return new;
end $$;
create trigger bookings_check_blocks before insert or update of delivery_date, pickup_date, status
  on public.bookings for each row execute function app.bookings_check_blocks();

create or replace function app.blocks_check_bookings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.bookings b
    where b.status in ('pending', 'approved')
      and daterange(b.delivery_date, b.pickup_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'BLOCK_OVERLAPS_BOOKING';
  end if;
  return new;
end $$;
create trigger blocks_check_bookings before insert or update on public.blocked_dates
  for each row execute function app.blocks_check_bookings();

create or replace function app.bookings_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then new.decided_at := now(); end if;
  return new;
end $$;
create trigger bookings_touch before update on public.bookings
  for each row execute function app.bookings_touch();

create or replace function app.settings_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.calendar_token := old.calendar_token;   -- the feed address never changes from the dashboard
  return new;
end $$;
create trigger settings_touch before update on public.settings
  for each row execute function app.settings_touch();

create or replace function app.bookings_emails() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_to text;
begin
  select owner_notify_email into owner_to from public.settings;
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform app.queue_email('booking_received', new.email, app.booking_payload(new), 'received:' || new.id);
      perform app.queue_email('owner_new_request', owner_to, app.booking_payload(new), 'owner-new:' || new.id);
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'approved' then
      perform app.queue_email('booking_approved', new.email, app.booking_payload(new), 'approved:' || new.id);
    elsif new.status = 'declined' then
      perform app.queue_email('booking_declined', new.email, app.booking_payload(new), 'declined:' || new.id);
    elsif new.status = 'cancelled' then
      perform app.queue_email('booking_cancelled', new.email, app.booking_payload(new), 'cancelled:' || new.id);
    elsif new.status = 'completed' then
      perform app.queue_email('thank_you', new.email, app.booking_payload(new), 'thanks:' || new.id);
    end if;
  end if;
  perform app.kick_mailer();
  return null;
end $$;
create trigger bookings_emails after insert or update of status on public.bookings
  for each row execute function app.bookings_emails();

create or replace function app.inquiries_emails() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_to text; p jsonb;
begin
  select owner_notify_email into owner_to from public.settings;
  p := jsonb_build_object('name', new.name, 'email', new.email, 'phone', new.phone, 'message', new.message, 'biz', app.biz());
  perform app.queue_email('inquiry_received', new.email, p, 'inq:' || new.id);
  perform app.queue_email('owner_new_inquiry', owner_to, p, 'owner-inq:' || new.id);
  perform app.kick_mailer();
  return null;
end $$;
create trigger inquiries_emails after insert on public.inquiries
  for each row execute function app.inquiries_emails();

-- ---------------------------------------------------------------- daily jobs
-- Reminders, follow-ups, completing finished rentals, and the owner's morning summary.
create or replace function app.daily_jobs() returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := app.today();
  s public.settings;
  b public.bookings;
  q public.inquiries;
  pending_list jsonb;
  upcoming_list jsonb;
  failed_count int;
begin
  select * into s from public.settings;

  for b in select * from public.bookings where status = 'approved' and delivery_date = today + 3 loop
    perform app.queue_email('prep_reminder', b.email, app.booking_payload(b), 'prep:' || b.id);
  end loop;
  for b in select * from public.bookings where status = 'approved' and delivery_date = today + 1 loop
    perform app.queue_email('delivery_tomorrow', b.email, app.booking_payload(b), 'deliv:' || b.id);
  end loop;
  for b in select * from public.bookings where status = 'approved' and pickup_date = today + 1 loop
    perform app.queue_email('pickup_tomorrow', b.email, app.booking_payload(b), 'pickup:' || b.id);
  end loop;

  -- Rentals picked up before today are finished; the status trigger sends the thank-you.
  update public.bookings set status = 'completed' where status = 'approved' and pickup_date < today;

  for b in select * from public.bookings where status = 'pending' and created_at < now() - interval '24 hours' loop
    perform app.queue_email('owner_pending_nudge', s.owner_notify_email, app.booking_payload(b), 'nudge:' || b.id || ':' || today);
  end loop;

  -- One gentle follow-up to people who asked a question and never booked.
  for q in
    select i.* from public.inquiries i
    where i.followup_queued_at is null and not i.handled
      and i.created_at < now() - interval '3 days' and i.created_at > now() - interval '14 days'
      and not exists (select 1 from public.bookings bk where lower(bk.email) = lower(i.email))
  loop
    perform app.queue_email('inquiry_followup', q.email,
      jsonb_build_object('name', q.name, 'biz', app.biz()), 'inq-follow:' || q.id);
    update public.inquiries set followup_queued_at = now() where id = q.id;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('ref', ref, 'name', customer_name, 'delivery_date', delivery_date,
           'pickup_date', pickup_date, 'city', city) order by created_at), '[]'::jsonb)
    into pending_list from public.bookings where status = 'pending';
  select coalesce(jsonb_agg(jsonb_build_object('ref', ref, 'name', customer_name, 'delivery_date', delivery_date,
           'pickup_date', pickup_date, 'city', city, 'phone', phone,
           'address', address_line || ', ' || city) order by delivery_date), '[]'::jsonb)
    into upcoming_list from public.bookings
    where status = 'approved' and delivery_date <= today + 7 and pickup_date >= today;
  select count(*) into failed_count from public.email_outbox where status = 'failed' and created_at > now() - interval '7 days';

  if jsonb_array_length(pending_list) > 0 or jsonb_array_length(upcoming_list) > 0 or failed_count > 0 then
    perform app.queue_email('owner_digest', s.owner_notify_email,
      jsonb_build_object('date', today, 'pending', pending_list, 'upcoming', upcoming_list,
                         'failed_emails', failed_count, 'biz', app.biz()),
      'digest:' || today);
  end if;

  perform app.kick_mailer();
end $$;

-- ---------------------------------------------------------------- email worker API (server only)
create or replace function public.mailer_claim(p_secret text, p_limit int default 20)
returns setof public.email_outbox language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from app.config c where c.mailer_secret = p_secret) then
    raise exception 'forbidden';
  end if;
  return query
    update public.email_outbox o
       set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
     where o.id in (
       select e.id from public.email_outbox e
        where e.send_after <= now() and e.attempts < 5
          and (e.status = 'pending' or (e.status = 'sending' and e.claimed_at < now() - interval '10 minutes'))
        order by e.created_at
        limit greatest(1, least(p_limit, 50))
        for update skip locked)
    returning o.*;
end $$;

create or replace function public.mailer_result(p_secret text, p_id uuid, p_ok boolean, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from app.config c where c.mailer_secret = p_secret) then
    raise exception 'forbidden';
  end if;
  if p_ok then
    update public.email_outbox set status = 'sent', sent_at = now(), last_error = null where id = p_id;
  else
    update public.email_outbox
       set status = case when attempts >= 5 then 'failed' else 'pending' end,
           last_error = left(coalesce(p_error, 'unknown error'), 500),
           send_after = now() + (attempts * interval '10 minutes')
     where id = p_id;
  end if;
end $$;

create or replace function public.calendar_feed(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or not exists (select 1 from public.settings s where s.calendar_token = p_token) then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object(
    'bookings', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'ref', ref, 'status', status, 'name', customer_name, 'phone', phone,
        'delivery_date', delivery_date, 'pickup_date', pickup_date,
        'address', address_line || ', ' || city || ', ' || state || ' ' || zip,
        'updated_at', updated_at) order by delivery_date), '[]'::jsonb)
      from public.bookings where status in ('pending', 'approved') and pickup_date >= app.today() - 30),
    'blocks', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'start_date', start_date, 'end_date', end_date, 'reason', reason) order by start_date), '[]'::jsonb)
      from public.blocked_dates where end_date >= app.today() - 30));
end $$;

revoke all on function public.mailer_claim(text, int) from public, anon, authenticated;
revoke all on function public.mailer_result(text, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.calendar_feed(text) from public, anon, authenticated;
grant execute on function public.mailer_claim(text, int) to service_role;
grant execute on function public.mailer_result(text, uuid, boolean, text) to service_role;
grant execute on function public.calendar_feed(text) to service_role;

-- ---------------------------------------------------------------- website API (public)
-- What the public site may know: prices, rules and which dates are taken. No names, no addresses.
create or replace function public.get_public_info()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'today', app.today(),
    'settings', (select jsonb_build_object(
        'base_town', s.base_town, 'contact_email', s.contact_email, 'contact_phone', s.contact_phone,
        'first_night_price', s.first_night_price, 'additional_night_price', s.additional_night_price,
        'free_delivery_miles', s.free_delivery_miles, 'per_mile_fee', s.per_mile_fee,
        'max_delivery_miles', s.max_delivery_miles, 'damage_deposit', s.damage_deposit,
        'firewood_bundle_price', s.firewood_bundle_price, 'seats', s.seats,
        'min_notice_days', s.min_notice_days, 'max_nights', s.max_nights,
        'delivery_time', s.delivery_time, 'pickup_time', s.pickup_time)
      from public.settings s),
    'unavailable', (
      select coalesce(jsonb_agg(jsonb_build_object('start', r.s, 'end', r.e) order by r.s), '[]'::jsonb)
      from (
        select delivery_date as s, pickup_date as e from public.bookings
         where status in ('pending', 'approved') and pickup_date >= app.today()
        union all
        select start_date, end_date from public.blocked_dates where end_date >= app.today()
      ) r));
$$;

create or replace function app.clean(p text, p_max int) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(trim(regexp_replace(coalesce(p, ''), '[\u0001-\u0008\u000B\u000C\u000E-\u001F]', '', 'g')), p_max), '');
$$;

create or replace function public.request_booking(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.settings;
  today date := app.today();
  v_name text := app.clean(p ->> 'name', 120);
  v_email text := lower(app.clean(p ->> 'email', 200));
  v_phone text := app.clean(p ->> 'phone', 40);
  v_addr text := app.clean(p ->> 'address_line', 200);
  v_city text := app.clean(p ->> 'city', 100);
  v_state text := coalesce(app.clean(p ->> 'state', 20), 'MN');
  v_zip text := app.clean(p ->> 'zip', 12);
  v_sig text := app.clean(p ->> 'signature', 120);
  v_wtext text := app.clean(p ->> 'waiver_text', 60000);
  v_wver text := app.clean(p ->> 'waiver_version', 60);
  v_delivery date;
  v_pickup date;
  v_nights int;
  v_miles int;
  v_guests int;
  v_wood int;
  v_estimate numeric(10,2);
  v_ip text := app.client_ip();
  b public.bookings;
begin
  -- Bots fill the hidden field; pretend it worked and save nothing.
  if coalesce(p ->> 'website', '') <> '' then
    return jsonb_build_object('ok', true, 'ref', 'SF-000000');
  end if;

  select * into s from public.settings;

  begin
    v_delivery := (p ->> 'delivery_date')::date;
    v_pickup := (p ->> 'pickup_date')::date;
    v_miles := nullif(p ->> 'miles_from_base', '')::int;
    v_guests := nullif(p ->> 'guest_count', '')::int;
    v_wood := coalesce(nullif(p ->> 'firewood_bundles', '')::int, 0);
  exception when others then
    raise exception 'INVALID_INPUT';
  end;

  if v_name is null or length(v_name) < 2 or v_phone is null or length(v_phone) < 7
     or v_addr is null or v_city is null or v_zip is null
     or v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'MISSING_DETAILS';
  end if;
  if v_delivery is null or v_pickup is null or v_pickup <= v_delivery then
    raise exception 'INVALID_DATES';
  end if;
  v_nights := v_pickup - v_delivery;
  if v_delivery < today + s.min_notice_days then raise exception 'TOO_SOON'; end if;
  if v_nights > s.max_nights then raise exception 'TOO_LONG'; end if;
  if v_delivery > today + 365 then raise exception 'TOO_FAR_AHEAD'; end if;
  if v_miles is not null and (v_miles < 0 or v_miles > 1000) then raise exception 'INVALID_INPUT'; end if;
  if v_guests is not null and (v_guests < 1 or v_guests > 500) then raise exception 'INVALID_INPUT'; end if;
  if v_wood < 0 or v_wood > 50 then raise exception 'INVALID_INPUT'; end if;
  if s.max_delivery_miles is not null and v_miles is not null and v_miles > s.max_delivery_miles then
    raise exception 'OUT_OF_AREA';
  end if;
  if coalesce((p ->> 'site_confirmed')::boolean, false) is not true then raise exception 'SITE_NOT_CONFIRMED'; end if;
  if v_sig is null or length(v_sig) < 3 or v_wver is null or v_wtext is null
     or jsonb_typeof(p -> 'statements') <> 'array' or jsonb_array_length(p -> 'statements') < 4 then
    raise exception 'WAIVER_NOT_SIGNED';
  end if;

  if (select count(*) from public.bookings where lower(email) = v_email and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  if v_ip is not null and (select count(*) from public.bookings where source_ip = v_ip and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;

  if s.first_night_price is not null then
    v_estimate := s.first_night_price
      + (v_nights - 1) * coalesce(s.additional_night_price, s.first_night_price)
      + greatest(coalesce(v_miles, 0) - coalesce(s.free_delivery_miles, 0), 0) * coalesce(s.per_mile_fee, 0)
      + v_wood * coalesce(s.firewood_bundle_price, 0);
  end if;

  begin
    insert into public.bookings (delivery_date, pickup_date, customer_name, email, phone, address_line, city, state, zip,
        miles_from_base, occasion, guest_count, firewood_bundles, site_confirmed, notes, estimate, source_ip)
    values (v_delivery, v_pickup, v_name, v_email, v_phone, v_addr, v_city, v_state, v_zip,
        v_miles, app.clean(p ->> 'occasion', 80), v_guests, v_wood, true, app.clean(p ->> 'notes', 2000), v_estimate, v_ip)
    returning * into b;
  exception when exclusion_violation then
    raise exception 'DATES_TAKEN';
  end;

  insert into public.waivers (booking_id, role, signer_name, signer_email, signature_text, statements,
      waiver_version, waiver_sha256, waiver_text, ip, user_agent)
  values (b.id, 'renter', v_name, v_email, v_sig, p -> 'statements', v_wver,
      app.clean(p ->> 'waiver_sha256', 80), v_wtext, v_ip, app.clean(p ->> 'user_agent', 400));

  return jsonb_build_object('ok', true, 'ref', b.ref, 'nights', b.nights, 'estimate', b.estimate);
end $$;

create or replace function public.sign_guest_waiver(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ref text := upper(app.clean(p ->> 'ref', 20));
  v_name text := app.clean(p ->> 'name', 120);
  v_sig text := app.clean(p ->> 'signature', 120);
  v_wver text := app.clean(p ->> 'waiver_version', 60);
  v_ip text := app.client_ip();
  b public.bookings;
begin
  if coalesce(p ->> 'website', '') <> '' then return jsonb_build_object('ok', true); end if;
  if v_name is null or length(v_name) < 2 or v_sig is null or length(v_sig) < 3 or v_wver is null
     or jsonb_typeof(p -> 'statements') <> 'array' or jsonb_array_length(p -> 'statements') < 2 then
    raise exception 'WAIVER_NOT_SIGNED';
  end if;
  select * into b from public.bookings where ref = v_ref and status in ('pending', 'approved');
  if not found then raise exception 'REF_NOT_FOUND'; end if;
  if (select count(*) from public.waivers where booking_id = b.id) >= 60 then raise exception 'TOO_MANY_REQUESTS'; end if;

  insert into public.waivers (booking_id, role, signer_name, signer_email, signature_text, minors, statements,
      waiver_version, waiver_sha256, waiver_text, ip, user_agent)
  values (b.id, 'guest', v_name, lower(app.clean(p ->> 'email', 200)), v_sig, app.clean(p ->> 'minors', 500),
      p -> 'statements', v_wver, app.clean(p ->> 'waiver_sha256', 80), app.clean(p ->> 'waiver_text', 60000),
      v_ip, app.clean(p ->> 'user_agent', 400));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.submit_inquiry(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_name text := app.clean(p ->> 'name', 120);
  v_email text := lower(app.clean(p ->> 'email', 200));
  v_msg text := app.clean(p ->> 'message', 3000);
  v_ip text := app.client_ip();
begin
  if coalesce(p ->> 'website', '') <> '' then return jsonb_build_object('ok', true); end if;
  if v_name is null or v_msg is null or v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'MISSING_DETAILS';
  end if;
  if (select count(*) from public.inquiries where lower(email) = v_email and created_at > now() - interval '24 hours') >= 3
     or (v_ip is not null and (select count(*) from public.inquiries where source_ip = v_ip and created_at > now() - interval '1 hour') >= 5) then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into public.inquiries (name, email, phone, message, source_ip)
  values (v_name, v_email, app.clean(p ->> 'phone', 40), v_msg, v_ip);
  return jsonb_build_object('ok', true);
end $$;

-- Lets the owner page tell "signed in but not on the admin list" from "signed in as admin".
create or replace function public.am_i_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_admin();
$$;

revoke all on function public.get_public_info() from public;
revoke all on function public.request_booking(jsonb) from public;
revoke all on function public.sign_guest_waiver(jsonb) from public;
revoke all on function public.submit_inquiry(jsonb) from public;
revoke all on function public.am_i_admin() from public, anon;
grant execute on function public.get_public_info() to anon, authenticated;
grant execute on function public.request_booking(jsonb) to anon, authenticated;
grant execute on function public.sign_guest_waiver(jsonb) to anon, authenticated;
grant execute on function public.submit_inquiry(jsonb) to anon, authenticated;
grant execute on function public.am_i_admin() to authenticated;

-- ---------------------------------------------------------------- lock down internals
-- Only is_admin() is callable by signed-in users; everything else in "app" is internal.
revoke all on all functions in schema app from public, anon, authenticated;
alter default privileges in schema app revoke execute on functions from public;
grant execute on function app.is_admin() to authenticated;

-- ---------------------------------------------------------------- schedule
-- 13:00 UTC is 7 am in Minnesota in winter and 8 am in summer.
select cron.schedule('stillfire-daily', '0 13 * * *', $$select app.daily_jobs()$$);
select cron.schedule('stillfire-mailer', '*/10 * * * *', $$select app.kick_mailer_if_pending()$$);
