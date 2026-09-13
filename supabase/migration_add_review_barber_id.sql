-- Denormalize barber_id onto reviews so the barber profile page can query
-- reviews directly without joining through bookings (which has RLS that
-- would block public/logged-out visitors from seeing them).

alter table public.reviews add column barber_id uuid references public.barber_profiles(id) on delete cascade;

create index reviews_barber_idx on public.reviews (barber_id);

-- Backfill barber_id for any reviews already created before this column existed
update public.reviews r
set barber_id = b.barber_id
from public.bookings b
where r.booking_id = b.id
  and r.barber_id is null;

-- Tighten the insert policy to also confirm barber_id matches the booking's
-- actual barber, not just any value the client sends
drop policy if exists "Customers can review their completed bookings" on public.reviews;

create policy "Customers can review their completed bookings"
  on public.reviews for insert with check (
    booking_id in (
      select id from public.bookings
      where customer_id = auth.uid() and status = 'completed'
    )
    and barber_id = (select barber_id from public.bookings where id = booking_id)
  );
