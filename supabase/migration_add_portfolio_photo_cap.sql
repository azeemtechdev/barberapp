-- Enforce the 6-photo cap at the database level — the frontend check is
-- just for UX, this is what actually guarantees it can't be bypassed.
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
