-- Since duration_minutes doesn't exist yet, look for exact duplicate
-- scheduled times for the same barber instead — the most likely cause
-- of the conflict (e.g. a double-click or retry during testing created
-- two bookings for the same slot).
select id, customer_id, barber_id, scheduled_time, status, created_at
from public.bookings
where status not in ('cancelled_by_customer', 'cancelled_by_barber', 'no_show')
order by barber_id, scheduled_time;
