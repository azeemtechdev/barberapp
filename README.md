# Barber marketplace — MVP

Next.js + Supabase + Paystack, built to run on free tiers until you have paying users.

## Stack

- **Frontend + hosting:** Next.js (App Router) on Vercel
- **Database + auth:** Supabase (Postgres + PostGIS for location search)
- **Payments:** Paystack (deposit-only, balance paid in person)

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the schema:** open the SQL editor in your Supabase dashboard, paste
   the contents of `supabase/schema.sql`, and run it. This creates every
   table, enum, RLS policy, the rating trigger, and the location/search
   helper functions.
3. **Copy `.env.example` to `.env.local`** and fill in your Supabase and
   Paystack keys, plus your deployed URL (or `http://localhost:3000` for
   local dev).
4. **Install and run:**
   ```bash
   npm install
   npm run dev
   ```
5. **Set up the Paystack webhook** once deployed: in your Paystack dashboard,
   add a webhook pointing to `https://your-domain/api/webhooks/paystack`.
   This is what actually confirms a booking after payment — the checkout
   redirect alone isn't reliable (see the comment in that file).

## What's built

**Auth**
- `app/signup` — role selection (customer/barber), creates the `users` row
  and, for barbers, an empty `barber_profiles` row
- `app/login`
- `middleware.ts` — keeps the Supabase session refreshed on every request

**Barber side**
- `app/barber/onboarding` — bio, shop location (via browser geolocation),
  home-service toggle + travel radius
- `app/barber/services` — add/list services, with optional home-service
  pricing per service
- `app/barber/dashboard` — upcoming bookings, mark-completed action
- `app/barber/[id]` — public profile page customers land on

**Customer side**
- `app/search` — geolocation-based search, using the `find_nearby_barbers`
  or `find_home_service_barbers` SQL functions depending on the toggle
- `app/booking/[serviceId]` — pick time and in-shop/home-service, shows the
  deposit vs. balance split, kicks off Paystack checkout
- `app/booking/confirmation` — polls booking status after the Paystack
  redirect, since the webhook is the actual source of truth
- `app/customer/bookings` — booking history + review submission

**Payments**
- `app/api/payments/initialize` — creates a `pending_payment` booking, then
  calls Paystack's initialize-transaction endpoint for the deposit amount
- `app/api/webhooks/paystack` — verifies Paystack's signature, records the
  payment, and flips the booking to `confirmed`
- `lib/pricing.ts` — deposit calculation (20% of total, ₦500 minimum) shared
  between the booking page and the payment route so they can't drift apart

## Policy decisions baked in (revisit these as you learn more)

- **Deposit only, balance in person.** Avoids needing Paystack's saved-card
  charge-authorization flow for MVP. See `lib/pricing.ts` to change the split.
- **Home service requires `home_service_verified = true`** on the barber's
  profile before it shows up in search — there's no verification UI built
  yet, so for now you'll need to flip this manually in the Supabase
  dashboard for barbers you've personally vetted.
- **No-show / cancellation logic isn't enforced in code** — the policy we
  discussed (refund on early cancellation, forfeit on no-show) needs to be
  built as an actual flow; right now a booking's status only moves via the
  webhook (confirmed) and the barber's dashboard (completed).

## Not built yet — natural next steps

1. Barber verification UI (ID + selfie upload, admin review queue)
2. Cancellation/no-show handling with the refund policy
3. Notifications (booking reminders, confirmations) — currently silent
4. A map view for search (currently a plain list)
5. Balance payment tracking (currently assumed to happen in person, off-app)

## Free tier limits to watch

- Supabase free tier pauses your project after 7 days of inactivity — set
  up a scheduled ping (free GitHub Actions cron) before real users depend
  on uptime.
- 500MB database storage on Supabase free tier is plenty for MVP records,
  but don't put barber portfolio images in the database — use Supabase
  Storage or Cloudinary instead.
