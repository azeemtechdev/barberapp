'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Booking } from '@/lib/types'

interface BookingWithDetails extends Booking {
  services: { name: string } | null
  reviews: { id: string }[] | null
}

export default function CustomerBookingsPage() {
  const supabase = createClient()
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  async function load() {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) return

    const { data } = await supabase
      .from('bookings')
      .select('*, services(name), reviews(id)')
      .eq('customer_id', authData.user.id)
      .order('scheduled_time', { ascending: false })

    setBookings((data as any) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function submitReview(bookingId: string, barberId: string) {
    await supabase.from('reviews').insert({
      booking_id: bookingId,
      barber_id: barberId,
      rating,
      comment: comment || null,
    })
    setReviewingId(null)
    setRating(5)
    setComment('')
    load()
  }

  if (loading) {
    return <main className="max-w-md mx-auto px-6 py-12">Loading…</main>
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <h1 className="text-2xl font-medium mb-6">Your bookings</h1>

      <div className="space-y-3">
        {bookings.map((b) => {
          const hasReview = (b.reviews ?? []).length > 0
          return (
            <div key={b.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{b.services?.name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(b.scheduled_time).toLocaleString()}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                  {b.status.replace(/_/g, ' ')}
                </span>
              </div>

              {b.status === 'completed' && !hasReview && reviewingId !== b.id && (
                <button
                  onClick={() => setReviewingId(b.id)}
                  className="text-sm text-brand mt-2"
                >
                  Leave a review
                </button>
              )}

              {reviewingId === b.id && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setRating(n)}
                        className={n <= rating ? 'text-amber-500' : 'text-gray-300'}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    rows={2}
                    placeholder="How was it?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <button
                    onClick={() => submitReview(b.id, b.barber_id)}
                    className="bg-brand text-white text-sm px-3 py-1.5 rounded-lg"
                  >
                    Submit review
                  </button>
                </div>
              )}

              {hasReview && (
                <p className="text-xs text-gray-400 mt-2">Review submitted ✓</p>
              )}
            </div>
          )
        })}
        {bookings.length === 0 && (
          <p className="text-sm text-gray-400">No bookings yet.</p>
        )}
      </div>
    </main>
  )
}
