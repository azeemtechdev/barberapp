-- Lets the app read back a barber's existing lat/lng (e.g. to pre-fill the
-- edit-profile form), since a plain select on barber_profiles returns the
-- raw PostGIS geography value, not usable lat/lng numbers.
create or replace function public.get_barber_coords(p_barber_id uuid)
returns table(lat float, lng float) as $$
  select st_y(location::geometry), st_x(location::geometry)
  from public.barber_profiles
  where id = p_barber_id;
$$ language sql stable;
