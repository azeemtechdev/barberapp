import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// Paystack calls this endpoint directly after a payment event — it's the
// source of truth for "did the money actually arrive", NOT the redirect
// the customer's browser follows after checkout. Never confirm a booking
// purely on the frontend redirect; a closed tab or flaky network means
// you'd never hear about it.

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature')

  // Verify the request actually came from Paystack
  const expectedSignature = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest('hex')

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  const supabase = createServiceRoleClient()

  if (event.event === 'charge.success') {
    const { reference, amount, metadata } = event.data
    // amount comes back in kobo (Paystack's smallest unit) — divide by 100 for naira
    const amountNaira = amount / 100
    const bookingId = metadata?.booking_id
    const paymentType = metadata?.payment_type // 'deposit' | 'balance'

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing booking_id in metadata' }, { status: 400 })
    }

    // Record the payment
    await supabase.from('payments').insert({
      booking_id: bookingId,
      type: paymentType,
      amount_naira: amountNaira,
      paystack_ref: reference,
      status: 'success',
      paid_at: new Date().toISOString(),
    })

    // Confirm the booking once the deposit clears
    if (paymentType === 'deposit') {
      await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId)
    }
  }

  return NextResponse.json({ received: true })
}
