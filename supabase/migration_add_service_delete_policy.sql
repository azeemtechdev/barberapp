-- Missing from the original schema: barbers need to be able to delete
-- their own services (used by the edit/delete UI on the services page).
create policy "Barbers can delete their own services"
  on public.services for delete using (
    auth.uid() in (select user_id from public.barber_profiles where id = barber_id)
  );
