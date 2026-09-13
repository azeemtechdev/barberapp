-- ── Portfolio photos table ───────────────────────────────────────────
create table public.barber_portfolio_images (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barber_profiles(id) on delete cascade,
  image_url text not null,
  storage_path text not null, -- needed to delete the file from storage too
  created_at timestamptz not null default now()
);

create index barber_portfolio_images_barber_idx on public.barber_portfolio_images (barber_id);

alter table public.barber_portfolio_images enable row level security;

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

-- Enforce the 6-photo cap at the database level too — the frontend check
-- is just for a good user experience, this is what actually guarantees it.
create or replace function public.enforce_portfolio_photo_limit()
returns trigger as $$
begin
  if (select count(*) from public.barber_portfolio_images where barber_id = new.barber_id) >= 6 then
    raise exception 'Portfolio photo limit reached (max 6)';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger before_portfolio_photo_insert
  before insert on public.barber_portfolio_images
  for each row execute function public.enforce_portfolio_photo_limit();

-- ── Storage bucket ───────────────────────────────────────────────────
-- Creates the bucket via SQL so you don't have to click through the
-- dashboard. "public" means anyone can view uploaded files by URL, which
-- is what you want for photos meant to be seen on public profiles.
insert into storage.buckets (id, name, public)
values ('barber-portfolios', 'barber-portfolios', true)
on conflict (id) do nothing;

-- Anyone can view photos in this bucket
create policy "Public read access to barber portfolio photos"
  on storage.objects for select
  using (bucket_id = 'barber-portfolios');

-- A barber can only upload into a folder named after their own barber_id
-- (the app uploads to `${barberId}/${filename}` — see the profile page code)
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
