'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface NearbyBarber {
  id: string
  bio: string | null
  address: string | null
  avg_rating: number
  offers_home_service: boolean
  distance_km: number
}

export default function SearchPage() {
  const supabase = createClient()

  const [homeServiceOnly, setHomeServiceOnly] = useState(false)
  const [manualAddress, setManualAddress] = useState('')
  const [barbers, setBarbers] = useState<NearbyBarber[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  async function runSearch(lat: number, lng: number) {
    const rpcName = homeServiceOnly ? 'find_home_service_barbers' : 'find_nearby_barbers'
    const { data, error: rpcError } = await supabase.rpc(rpcName, {
      customer_lng: lng,
      customer_lat: lat,
    })

    if (rpcError) {
      setError(rpcError.message)
    } else {
      setBarbers(data ?? [])
    }
    setSearched(true)
    setLoading(false)
  }

  function searchByGeolocation() {
    setError(null)
    setLoading(true)

    if (!navigator.geolocation) {
      setError('Your browser does not support location search — enter your address instead.')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => runSearch(pos.coords.latitude, pos.coords.longitude),
      () => {
        setError(
          'Could not get your location (this often fails outside localhost/https). Try entering your address instead.'
        )
        setLoading(false)
      }
    )
  }

  async function searchByAddress() {
    setError(null)
    if (!manualAddress.trim()) {
      setError('Type an address first.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddress)}&limit=1`
      )
      const results = await res.json()
      if (!results.length) {
        setError('Could not find that address. Try adding more detail.')
        setLoading(false)
        return
      }
      await runSearch(parseFloat(results[0].lat), parseFloat(results[0].lon))
    } catch {
      setError('Address lookup failed. Check your internet connection and try again.')
      setLoading(false)
    }
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <h1 className="text-2xl font-medium mb-1">Find a barber near you</h1>
      <p className="text-gray-500 mb-6">Use your location, or type an address.</p>

      <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
        <input
          type="checkbox"
          checked={homeServiceOnly}
          onChange={(e) => setHomeServiceOnly(e.target.checked)}
        />
        Only show barbers who come to me
      </label>

      <div className="space-y-2 mb-8">
        <button
          onClick={searchByGeolocation}
          disabled={loading}
          className="w-full bg-brand text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Use my current location'}
        </button>

        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Or type an address"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
          />
          <button
            onClick={searchByAddress}
            disabled={loading}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            Search
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="space-y-3">
        {barbers.map((b) => (
          <a
            key={b.id}
            href={`/barber/${b.id}`}
            className="block border border-gray-200 rounded-lg p-4 hover:border-brand"
          >
            <div className="flex justify-between">
              <span className="font-medium">{b.address ?? 'Barber'}</span>
              <span className="text-sm text-gray-500">{b.distance_km.toFixed(1)} km</span>
            </div>
            {b.bio && <p className="text-sm text-gray-600 mt-1">{b.bio}</p>}
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-gray-500">★ {b.avg_rating.toFixed(1)}</span>
              {b.offers_home_service && (
                <span className="text-brand">Home service available</span>
              )}
            </div>
          </a>
        ))}
        {searched && barbers.length === 0 && !loading && (
          <p className="text-sm text-gray-400">
            No barbers found nearby. Try widening your search or check back later.
          </p>
        )}
      </div>
    </main>
  )
}
