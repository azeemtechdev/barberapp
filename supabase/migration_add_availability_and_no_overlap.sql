-- ── Working hours ────────────────────────────────────────────────────
alter table public.barber_profiles
  add column work_start_time time not null default '09:00',
  add column work_end_time time not null default '18:00',
  add column work_days int[] not null default '{1,2,3,4,5,6}';

-- ── Snapshot duration onto bookings ──────────────────────────────────
alter table public.bookings
  add column duration_minutes int not null default 30;

-- ── The actual double-booking guard ──────────────────────────────────
-- Postgres classifies timestamptz + interval as STABLE, not IMMUTABLE,
-- because interval arithmetic can in general depend on timezone rules
-- (e.g. month/day components). We're only ever adding a plain number of
-- minutes here, which is genuinely timezone-independent, so we wrap it in
-- our own function and explicitly mark it IMMUTABLE — required because
-- GiST exclusion constraints only accept immutable expressions.
create or replace function public.booking_range(p_start timestamptz, p_duration_minutes int)
returns tstzrange as $$
  select tstzrange(p_start, p_start + (p_duration_minutes * interval '1 minute'));
$$ language sql immutable;

create extension if not exists btree_gist;

alter table public.bookings
  add constraint no_overlapping_bookings
  exclude using gist (
    barber_id with =,
    public.booking_range(scheduled_time, duration_minutes) with &&
  )
  where (status not in ('cancelled_by_customer', 'cancelled_by_barber', 'no_show'));

-- ── Available slots function ─────────────────────────────────────────
create or replace function public.get_available_slots(
  p_barber_id uuid,
  p_date date,
  p_duration_minutes int
)
returns table(slot_time timestamptz) as $$
declare
  v_start time;
  v_end time;
  v_days int[];
  v_dow int;
begin
  select work_start_time, work_end_time, work_days
  into v_start, v_end, v_days
  from public.barber_profiles
  where id = p_barber_id;

  v_dow := extract(dow from p_date);

  if v_days is null or not (v_dow = any(v_days)) then
    return;
  end if;

  return query
  select candidate
  from generate_series(
    (p_date + v_start)::timestamptz,
    (p_date + v_end)::timestamptz - (p_duration_minutes || ' minutes')::interval,
    interval '30 minutes'
  ) as candidate
  where candidate > now()
    and not exists (
      select 1 from public.bookings b
      where b.barber_id = p_barber_id
        and b.status not in ('cancelled_by_customer', 'cancelled_by_barber', 'no_show')
        and public.booking_range(b.scheduled_time, b.duration_minutes)
            && public.booking_range(candidate, p_duration_minutes)
    );
end;
$$ language plpgsql stable;
