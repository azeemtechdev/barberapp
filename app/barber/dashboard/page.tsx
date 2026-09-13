'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Booking } from '@/lib/types'

interface BookingWithDetails extends Booking {
  services: { name: string } | null
  users: { full_name: string; phone: string | null } | null
}

export default function BarberDashboardPage() {
  const supabase = createClient()
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) return

    const { data: barber } = await supabase
      .from('barber_profiles')
      .select('id')
      .eq('user_id', authData.user.id)
      .single()

    if (!barber) return

    const { data } = await supabase
      .from('bookings')
      .select('*, services(name), users:customer_id(full_name, phone)')
      .eq('barber_id', barber.id)
      .order('scheduled_time', { ascending: true })

    setBookings((data as any) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function markCompleted(id: string) {
    await supabase.from('bookings').update({ status: 'completed' }).eq('id', id)
    load()
  }

  if (loading) {
    return <main className="max-w-md mx-auto px-6 py-12">Loading…</main>
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <h1 className="text-2xl font-medium mb-6">Your bookings</h1>

      <div className="space-y-3">
        {bookings.map((b) => (
          <div key={b.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{b.services?.name}</p>
                <p className="text-sm text-gray-600">{b.users?.full_name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(b.scheduled_time).toLocaleString()}
                </p>
                {b.location_type === 'home_service' && (
                  <p className="text-xs text-brand mt-1">Home service — {b.customer_address}</p>
                )}
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                {b.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="flex justify-between items-center mt-3 text-sm">
              <span className="text-gray-500">
                Balance due: ₦{(b.total_naira - b.deposit_amount).toLocaleString()}
              </span>
              {b.status === 'confirmed' && (
                <button
                  onClick={() => markCompleted(b.id)}
                  className="bg-brand text-white text-xs px-3 py-1.5 rounded-lg"
                >
                  Mark completed
                </button>
              )}
            </div>
          </div>
        ))}
        {bookings.length === 0 && (
          <p className="text-sm text-gray-400">No bookings yet.</p>
        )}
      </div>
    </main>
  )
}
