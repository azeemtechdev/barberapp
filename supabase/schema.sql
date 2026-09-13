-- ══════════════════════════════════════════════════════════════════════
-- CONSOLIDATED SCHEMA — reflects the current live state of the database
-- as of all migrations run through the "chat + photo compression" update.
--
-- This file is for REFERENCE and DISASTER RECOVERY (e.g. spinning up a
-- fresh Supabase project to match production). Do NOT run this against
-- your existing database — every table/policy already exists there and
-- this will error on "already exists". Only run this on a brand-new,
-- empty Supabase project.
-- ══════════════════════════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────────────────────────
create extension if not exists postgis;
create extension if not exists btree_gist;

-- ── Enums ────────────────────────────────────────────────────────────
create type user_role as enum ('customer', 'barber');
create type location_type as enum ('in_shop', 'home_service');
create type booking_status as enum (
  'pending_payment',
  'confirmed',
  'completed',
  'cancelled_by_customer',
  'cancelled_by_barber',
  'no_show'
);
create type payment_type as enum ('deposit', 'balance', 'refund');
create type payment_status as enum ('pending', 'success', 'failed');

-- ── Users ────────────────────────────────────────────────────────────
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  phone text,
  role user_role not null default 'customer',
  created_at timestamptz not null default now()
);

-- ── Barber profiles ──────────────────────────────────────────────────
create table public.barber_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  bio text,
  location geography(point, 4326),
  address text,
  offers_home_service boolean not null default false,
  service_radius_km int default 5,
  is_verified boolean not null default false,
  home_service_verified boolean not null default false,
  avg_rating numeric(2,1) default 0,
  work_start_time time not null default '09:00',
  work_end_time time not null default '18:00',
  work_days int[] not null default '{1,2,3,4,5,6}', -- 0=Sunday..6=Saturday
  created_at timestamptz not null default now()
);

create index barber_profiles_location_idx on public.barber_profiles using gist (location);

-- ── Services ─────────────────────────────────────────────────────────
create table public.services (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barber_profiles(id) on delete cascade,
  name text not null,
  price_naira int not null,
  duration_minutes int not null,
  home_service_available boolean not null default false,
  home_service_fee int default 0,
  created_at timestamptz not null default now()
);

-- ── Bookings ─────────────────────────────────────────────────────────
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(id) on delete cascade,
  barber_id uuid not null references public.barber_profiles(id) on delete cascade,
  service_id uuid not null references public.services(id),
  scheduled_time timestamptz not null,
  duration_minutes int not null default 30,
  location_type location_type not null default 'in_shop',
  customer_lat float,
  customer_lng float,
  customer_address text,
  total_naira int not null,
  deposit_amount int not null,
  status booking_status not null default 'pending_payment',
  created_at timestamptz not null default now()
);

create index bookings_barber_idx on public.bookings (barber_id, scheduled_time);
create index bookings_customer_idx on public.bookings (customer_id);

-- ── Payments ─────────────────────────────────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  type payment_type not null,
  amount_naira int not null,
  paystack_ref text unique,
  status payment_status not null default 'pending',
  paid_at timestamptz
);

create index payments_booking_idx on public.payments (booking_id);

-- ── Reviews ──────────────────────────────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  barber_id uuid not null references public.barber_profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index reviews_barber_idx on public.reviews (barber_id);

-- ── Barber portfolio photos ──────────────────────────────────────────
create table public.barber_portfolio_images (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barber_profiles(id) on delete cascade,
  image_url text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index barber_portfolio_images_barber_idx on public.barber_portfolio_images (barber_id);

-- ── Chat: conversations + messages ───────────────────────────────────
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(id) on delete cascade,
  barber_id uuid not null references public.barber_profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (customer_id, barber_id)
);

create index conversations_customer_idx on public.conversations (customer_id);
create index conversations_barber_idx on public.conversations (barber_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ══════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════

alter table public.users enable row level security;
alter table public.barber_profiles enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.barber_portfolio_images enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Users can view their own profile"
  on public.users for select using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.users for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update using (auth.uid() = id);

create policy "Booking participants can view each other's basic info"
  on public.users for select using (
    id in (
      select customer_id from public.bookings b
      join public.barber_profiles bp on bp.id = b.barber_id
      where bp.user_id = auth.uid()
    )
    or id in (
      select bp.user_id from public.barber_profiles bp
      join public.bookings b on b.barber_id = bp.id
      where b.customer_id = auth.uid()
    )
  );

create policy "Conversation participants can view each other's basic info"
  on public.users for select using (
    id in (
      select customer_id from public.conversations c
      join public.barber_profiles bp on bp.id = c.barber_id
      where bp.user_id = auth.uid()
    )
    or id in (
      select bp.user_id from public.barber_profiles bp
      join public.conversations c on c.barber_id = bp.id
      where c.customer_id = auth.uid()
    )
  );

create policy "Barber profiles are publicly viewable"
  on public.barber_profiles for select using (true);

create policy "Barbers can insert their own barber profile"
  on public.barber_profiles for insert with check (auth.uid() = user_id);

create policy "Barbers can update their own barber profile"
  on public.barber_profiles for update using (auth.uid() = user_id);

create policy "Services are publicly viewable"
  on public.services for select using (true);

create policy "Barbers can insert their own services"
  on public.services for insert with check (
    auth.uid() in (select user_id from public.barber_profiles where id = barber_id)
  );

create policy "Barbers can update their own services"
  on public.services for update using (
    auth.uid() in (select user_id from public.barber_profiles where id = barber_id)
  );

create policy "Barbers can delete their own services"
  on public.services for delete using (
    auth.uid() in (select user_id from public.barber_profiles where id = barber_id)
  );

create policy "Customers can view their own bookings"
  on public.bookings for select using (auth.uid() = customer_id);

create policy "Barbers can view bookings made with them"
  on public.bookings for select using (
    auth.uid() in (select user_id from public.barber_profiles where id = barber_id)
  );

create policy "Customers can create bookings"
  on public.bookings for insert with check (auth.uid() = customer_id);

create policy "Barbers can update bookings made with them"
  on public.bookings for update using (
    auth.uid() in (select user_id from public.barber_profiles where id = barber_id)
  );

create policy "Booking participants can view payments"
  on public.payments for select using (
    booking_id in (
      select id from public.bookings where customer_id = auth.uid()
      union
      select b.id from public.bookings b
      join public.barber_profiles bp on bp.id = b.barber_id
      where bp.user_id = auth.uid()
    )
  );

create policy "Reviews are publicly viewable"
  on public.reviews for select using (true);

create policy "Customers can review their completed bookings"
  on public.reviews for insert with check (
    booking_id in (
      select id from public.bookings
      where customer_id = auth.uid() and status = 'completed'
    )
    and barber_id = (select barber_id from public.bookings where id = booking_id)
  );

create policy "Portfolio photos are publicly viewable"
  on public.barber_portfolio_images for select using (true);

create policy "Barbers can add their own portfolio photos"
  on public.barber_portfolio_images for insert with check (
    auth.uid() in (select user_id from public.barber_profiles where id = barber_id)
  );

create policy "Barbers can delete their own portfolio photos"
  on public.barber_portfolio_images for delete using (
    auth.uid() in (select user_id from public.barber_profiles where id = barber_id)
  );

create policy "Participants can view their conversations"
  on public.conversations for select using (
    auth.uid() = customer_id
    or auth.uid() in (select user_id from public.barber_profiles where id = barber_id)
  );

create policy "Customers can start a conversation with a barber"
  on public.conversations for insert with check (auth.uid() = customer_id);

create policy "Participants can view messages in their conversations"
  on public.messages for select using (
    conversation_id in (
      select id from public.conversations
      where customer_id = auth.uid()
         or barber_id in (select id from public.barber_profiles where user_id = auth.uid())
    )
  );

create policy "Participants can send messages in their conversations"
  on public.messages for insert with check (
    sender_id = auth.uid()
    and conversation_id in (
      select id from public.conversations
      where customer_id = auth.uid()
         or barber_id in (select id from public.barber_profiles where user_id = auth.uid())
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.set_barber_location(
  p_barber_id uuid, p_lng float, p_lat float
)
returns void as $$
  update public.barber_profiles
  set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  where id = p_barber_id;
$$ language sql volatile;

create or replace function public.get_barber_coords(p_barber_id uuid)
returns table(lat float, lng float) as $$
  select st_y(location::geometry), st_x(location::geometry)
  from public.barber_profiles
  where id = p_barber_id;
$$ language sql stable;

create or replace function public.find_home_service_barbers(
  customer_lng float, customer_lat float
)
returns table (
  id uuid, user_id uuid, bio text, lat float, lng float, address text,
  service_radius_km int, is_verified boolean, home_service_verified boolean,
  avg_rating numeric, distance_km float
) as $$
  select
    bp.id, bp.user_id, bp.bio,
    st_y(bp.location::geometry) as lat,
    st_x(bp.location::geometry) as lng,
    bp.address, bp.service_radius_km, bp.is_verified, bp.home_service_verified, bp.avg_rating,
    st_distance(
      bp.location,
      st_setsrid(st_makepoint(customer_lng, customer_lat), 4326)::geography
    ) / 1000 as distance_km
  from public.barber_profiles bp
  where bp.offers_home_service = true
    and bp.home_service_verified = true
    and st_dwithin(
      bp.location,
      st_setsrid(st_makepoint(customer_lng, customer_lat), 4326)::geography,
      bp.service_radius_km * 1000
    )
  order by distance_km asc;
$$ language sql stable;

create or replace function public.find_nearby_barbers(
  customer_lng float, customer_lat float, radius_km float default 15
)
returns table (
  id uuid, user_id uuid, bio text, lat float, lng float, address text,
  offers_home_service boolean, is_verified boolean, avg_rating numeric, distance_km float
) as $$
  select
    bp.id, bp.user_id, bp.bio,
    st_y(bp.location::geometry) as lat,
    st_x(bp.location::geometry) as lng,
    bp.address, bp.offers_home_service, bp.is_verified, bp.avg_rating,
    st_distance(
      bp.location,
      st_setsrid(st_makepoint(customer_lng, customer_lat), 4326)::geography
    ) / 1000 as distance_km
  from public.barber_profiles bp
  where bp.location is not null
    and st_dwithin(
      bp.location,
      st_setsrid(st_makepoint(customer_lng, customer_lat), 4326)::geography,
      radius_km * 1000
    )
  order by distance_km asc;
$$ language sql stable;

create or replace function public.booking_range(p_start timestamptz, p_duration_minutes int)
returns tstzrange as $$
  select tstzrange(p_start, p_start + (p_duration_minutes * interval '1 minute'));
$$ language sql immutable;

create or replace function public.get_available_slots(
  p_barber_id uuid, p_date date, p_duration_minutes int
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

create or replace function public.update_barber_rating()
returns trigger as $$
declare
  v_barber_id uuid;
begin
  select barber_id into v_barber_id from public.bookings where id = new.booking_id;

  update public.barber_profiles
  set avg_rating = (
    select round(avg(r.rating)::numeric, 1)
    from public.reviews r
    join public.bookings b on b.id = r.booking_id
    where b.barber_id = v_barber_id
  )
  where id = v_barber_id;

  return new;
end;
$$ language plpgsql security definer;

create or replace function public.enforce_portfolio_photo_limit()
returns trigger as $$
begin
  if (select count(*) from public.barber_portfolio_images where barber_id = new.barber_id) >= 6 then
    raise exception 'Portfolio photo limit reached (max 6)';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.touch_conversation_on_message()
returns trigger as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

-- ══════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════

create trigger on_review_insert
  after insert on public.reviews
  for each row execute function public.update_barber_rating();

create trigger before_portfolio_photo_insert
  before insert on public.barber_portfolio_images
  for each row execute function public.enforce_portfolio_photo_limit();

create trigger on_message_insert
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- ══════════════════════════════════════════════════════════════════════
-- THE DOUBLE-BOOKING GUARD
-- ══════════════════════════════════════════════════════════════════════

alter table public.bookings
  add constraint no_overlapping_bookings
  exclude using gist (
    barber_id with =,
    public.booking_range(scheduled_time, duration_minutes) with &&
  )
  where (status not in ('cancelled_by_customer', 'cancelled_by_barber', 'no_show'));

-- ══════════════════════════════════════════════════════════════════════
-- STORAGE: barber portfolio photos
-- ══════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('barber-portfolios', 'barber-portfolios', true)
on conflict (id) do nothing;

create policy "Public read access to barber portfolio photos"
  on storage.objects for select
  using (bucket_id = 'barber-portfolios');

create policy "Barbers can upload into their own portfolio folder"
  on storage.objects for insert
  with check (
    bucket_id = 'barber-portfolios'
    and (storage.foldername(name))[1] in (
      select id::text from public.barber_profiles where user_id = auth.uid()
    )
  );

create policy "Barbers can delete from their own portfolio folder"
  on storage.objects for delete
  using (
    bucket_id = 'barber-portfolios'
    and (storage.foldername(name))[1] in (
      select id::text from public.barber_profiles where user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- REALTIME
-- ══════════════════════════════════════════════════════════════════════

alter publication supabase_realtime add table public.messages;
