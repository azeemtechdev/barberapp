'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Booking } from '@/lib/types'

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('booking_id')
  const supabase = createClient()

  const [booking, setBooking] = useState<Booking | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!bookingId) return

    let attempts = 0
    const interval = setInterval(async () => {
      attempts += 1
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single()

      if (data) setBooking(data)

      if (data?.status === 'confirmed' || attempts >= 8) {
        clearInterval(interval)
        setChecking(false)
      }
    }, 1500)

    return () => clearInterval(interval)
  }, [bookingId])

  return (
    <main className="max-w-md mx-auto px-6 py-12 text-center">
      {checking && <p className="text-gray-500">Confirming your payment…</p>}

      {!checking && booking?.status === 'confirmed' && (
        <>
          <h1 className="text-2xl font-medium mb-2">Booking confirmed 🎉</h1>
          <p className="text-gray-600">
            Your slot is booked for {new Date(booking.scheduled_time).toLocaleString()}.
            The remaining balance of ₦{(booking.total_naira - booking.deposit_amount).toLocaleString()} is due in person.
          </p>
        </>
      )}

      {!checking && booking?.status !== 'confirmed' && (
        <>
          <h1 className="text-2xl font-medium mb-2">Still processing</h1>
          <p className="text-gray-600">
            We haven't confirmed your payment yet. If money left your account, this will update
            shortly — otherwise, please try booking again.
          </p>
        </>
      )}

      <a href="/customer/bookings" className="inline-block mt-6 text-brand">
        View my bookings →
      </a>
    </main>
  )
}

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={<main className="max-w-md mx-auto px-6 py-12 text-center text-gray-500">Loading…</main>}>
      <ConfirmationContent />
    </Suspense>
  )
}
