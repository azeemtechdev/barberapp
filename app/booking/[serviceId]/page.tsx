'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculateDeposit } from '@/lib/pricing'
import type { Service } from '@/lib/types'
import BackHeader from '@/components/BackHeader'

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export default function BookingPage() {
  const params = useParams<{ serviceId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [service, setService] = useState<Service | null>(null)
  const [date, setDate] = useState(todayISO())
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [locationType, setLocationType] = useState<'in_shop' | 'home_service'>('in_shop')
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('id', params.serviceId)
        .single()
      setService(data)
    }
    load()
  }, [params.serviceId])

  useEffect(() => {
    async function loadSlots() {
      if (!service) return
      setSlotsLoading(true)
      setSelectedSlot(null)
      const { data, error: slotError } = await supabase.rpc('get_available_slots', {
        p_barber_id: service.barber_id,
        p_date: date,
        p_duration_minutes: service.duration_minutes,
      })
      if (slotError) {
        setError(slotError.message)
      } else {
        setSlots((data ?? []).map((row: { slot_time: string }) => row.slot_time))
      }
      setSlotsLoading(false)
    }
    loadSlots()
  }, [service, date])

  function captureCustomerLocation() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    })
  }

  const total =
    service && locationType === 'home_service'
      ? service.price_naira + service.home_service_fee
      : service?.price_naira ?? 0
  const deposit = calculateDeposit(total)

  async function handleBook() {
    setError(null)

    if (!service || !selectedSlot) {
      setError('Pick an available time slot.')
      return
    }
    if (locationType === 'home_service' && (!address || !coords)) {
      setError('Enter your address and share your location for home service.')
      return
    }

    setSubmitting(true)

    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      router.push('/login')
      return
    }

    const res = await fetch('/api/payments/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: authData.user.id,
        serviceId: service.id,
        barberId: service.barber_id,
        scheduledTime: selectedSlot,
        durationMinutes: service.duration_minutes,
        locationType,
        customerAddress: locationType === 'home_service' ? address : null,
        customerLat: coords?.lat ?? null,
        customerLng: coords?.lng ?? null,
        totalNaira: total,
        depositAmount: deposit,
        email: authData.user.email,
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'Could not start payment.')
      // The slot might have just been taken by someone else — refresh the list
      if (res.status === 409 && service) {
        const { data } = await supabase.rpc('get_available_slots', {
          p_barber_id: service.barber_id,
          p_date: date,
          p_duration_minutes: service.duration_minutes,
        })
        setSlots((data ?? []).map((row: { slot_time: string }) => row.slot_time))
        setSelectedSlot(null)
      }
      setSubmitting(false)
      return
    }

    window.location.href = json.authorizationUrl
  }

  if (!service) {
    return <main className="max-w-md mx-auto px-6 py-8">Loading…</main>
  }

  return (
    <main className="max-w-md mx-auto px-6 py-8">
      <BackHeader title={service.name} />
      <p className="text-gray-500 -mt-4 mb-6">{service.duration_minutes} min</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Date</label>
          <input
            type="date"
            min={todayISO()}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-2">Available times</label>
          {slotsLoading && <p className="text-sm text-gray-400">Loading times…</p>}
          {!slotsLoading && slots.length === 0 && (
            <p className="text-sm text-gray-400">
              No openings this day — try a different date.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => {
              const label = new Date(slot).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })
              const active = selectedSlot === slot
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${
                    active ? 'bg-brand text-white border-brand' : 'border-gray-300 text-gray-700'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {service.home_service_available && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLocationType('in_shop')}
              className={`flex-1 py-2 rounded-lg border text-sm ${
                locationType === 'in_shop' ? 'bg-brand text-white border-brand' : 'border-gray-300'
              }`}
            >
              At the shop
            </button>
            <button
              type="button"
              onClick={() => setLocationType('home_service')}
              className={`flex-1 py-2 rounded-lg border text-sm ${
                locationType === 'home_service' ? 'bg-brand text-white border-brand' : 'border-gray-300'
              }`}
            >
              At my place (+₦{service.home_service_fee.toLocaleString()})
            </button>
          </div>
        )}

        {locationType === 'home_service' && (
          <div>
            <label className="block text-sm text-gray-700 mb-1">Your address</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <button
              type="button"
              onClick={captureCustomerLocation}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2"
            >
              {coords ? 'Location shared ✓' : 'Share my location'}
            </button>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Total</span>
            <span>₦{total.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Deposit due now</span>
            <span>₦{deposit.toLocaleString()}</span>
          </div>
          <p className="text-xs text-gray-400">
            Balance of ₦{(total - deposit).toLocaleString()} is paid in person after the cut.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleBook}
          disabled={submitting || !selectedSlot}
          className="w-full bg-brand text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {submitting ? 'Starting payment…' : `Pay deposit · ₦${deposit.toLocaleString()}`}
        </button>
      </div>
    </main>
  )
}
