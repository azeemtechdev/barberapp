-- Step 1: Find the overlapping bookings so you can see what's there
select id, customer_id, barber_id, scheduled_time, duration_minutes, status, created_at
from public.bookings
where barber_id = '67c2378e-14a2-48cd-8157-044501157cef'
  and status not in ('cancelled_by_customer', 'cancelled_by_barber', 'no_show')
order by scheduled_time;

-- Step 2: Once you've looked at the results above and picked which one to
-- keep, cancel the other(s) instead of deleting — keeps your payment
-- records intact. Replace the id below with the one you want to remove:

-- update public.bookings
-- set status = 'cancelled_by_barber'
-- where id = 'PASTE_THE_DUPLICATE_BOOKING_ID_HERE';

-- Step 3: After cleaning up, re-run just this part from the previous
-- migration to actually add the constraint:

-- create extension if not exists btree_gist;
--
-- alter table public.bookings
--   add constraint no_overlapping_bookings
--   exclude using gist (
--     barber_id with =,
--     public.booking_range(scheduled_time, duration_minutes) with &&
--   )
--   where (status not in ('cancelled_by_customer', 'cancelled_by_barber', 'no_show'));
