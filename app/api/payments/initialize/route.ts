import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    customerId,
    serviceId,
    barberId,
    scheduledTime,
    durationMinutes,
    locationType,
    customerAddress,
    customerLat,
    customerLng,
    totalNaira,
    depositAmount,
    email,
  } = body

  if (!customerId || !serviceId || !barberId || !scheduledTime || !durationMinutes || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Create the booking in a pending state — it only becomes 'confirmed'
  // once the Paystack webhook confirms the deposit actually cleared.
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      customer_id: customerId,
      service_id: serviceId,
      barber_id: barberId,
      scheduled_time: scheduledTime,
      duration_minutes: durationMinutes,
      location_type: locationType,
      customer_address: customerAddress,
      customer_lat: customerLat,
      customer_lng: customerLng,
      total_naira: totalNaira,
      deposit_amount: depositAmount,
      status: 'pending_payment',
    })
    .select()
    .single()

  if (bookingError) {
    // Postgres exclusion-constraint violation — someone else booked this
    // slot in the moment between the customer viewing it and clicking pay.
    if (bookingError.code === '23P01') {
      return NextResponse.json(
        { error: 'That time slot was just taken. Please pick another.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: bookingError.message }, { status: 500 })
  }

  if (!booking) {
    return NextResponse.json({ error: 'Could not create booking' }, { status: 500 })
  }

  // ── DEV BYPASS ──────────────────────────────────────────────────────
  // Set SKIP_PAYSTACK=true in .env.local to skip real payment entirely and
  // auto-confirm the booking, so you can test search → booking → dashboard →
  // reviews without Paystack keys set up yet.
  // DELETE THIS BLOCK (or make sure the env var is unset) before going live —
  // it lets anyone "pay" for a booking with no money changing hands.
  if (process.env.SKIP_PAYSTACK === 'true') {
    await supabase.from('payments').insert({
      booking_id: booking.id,
      type: 'deposit',
      amount_naira: depositAmount,
      paystack_ref: `dev-bypass-${booking.id}`,
      status: 'success',
      paid_at: new Date().toISOString(),
    })
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id)

    return NextResponse.json({
      authorizationUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/booking/confirmation?booking_id=${booking.id}`,
      bookingId: booking.id,
    })
  }
  // ── END DEV BYPASS ──────────────────────────────────────────────────

  // Paystack amounts are in kobo (smallest unit) — multiply naira by 100.
  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: depositAmount * 100,
      callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/booking/confirmation?booking_id=${booking.id}`,
      metadata: {
        booking_id: booking.id,
        payment_type: 'deposit',
      },
    }),
  })

  const paystackJson = await paystackRes.json()

  if (!paystackJson.status) {
    return NextResponse.json(
      { error: paystackJson.message ?? 'Paystack initialization failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    authorizationUrl: paystackJson.data.authorization_url,
    bookingId: booking.id,
  })
}
