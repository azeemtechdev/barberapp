-- Cancel the three abandoned pending_payment duplicates, keeping the
-- completed one (which has your review attached) untouched.
update public.bookings
set status = 'cancelled_by_customer'
where id in (
  'b5fa22cf-9ae7-4931-bb54-2009ec0c1d52',
  '43f842ab-c910-4829-b05e-8b51daac8e82',
  '40572590-ce26-4e52-8cb7-0e588ebd18f2'
);
