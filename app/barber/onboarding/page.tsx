'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function BarberOnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [bio, setBio] = useState('')
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [offersHomeService, setOffersHomeService] = useState(false)
  const [radiusKm, setRadiusKm] = useState(5)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function captureLocation() {
    setError(null)
    setLocating(true)
    if (!navigator.geolocation) {
      setError('Your browser does not support location capture — use "Look up address" instead.')
      setLocating(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setError('Could not get your location. Check browser/OS permissions, or use "Look up address" instead.')
        setLocating(false)
      }
    )
  }

  async function geocodeAddress() {
    setError(null)
    if (!address.trim()) {
      setError('Type your shop address first.')
      return
    }
    setLocating(true)
    try {
      // Nominatim is OpenStreetMap's free geocoding service — no API key needed.
      // Fine for MVP volume; swap for Google Geocoding if you need higher accuracy later.
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      )
      const results = await res.json()
      if (!results.length) {
        setError('Could not find that address. Try adding more detail, or use "Use my current location" instead.')
        setLocating(false)
        return
      }
      setCoords({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) })
    } catch {
      setError('Address lookup failed. Check your internet connection and try again.')
    }
    setLocating(false)
  }

  async function handleSave() {
    setError(null)

    if (!coords) {
      setError('Set your shop location before continuing.')
      return
    }

    setSaving(true)

    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      setError('Not logged in.')
      setSaving(false)
      return
    }

    const { data: barberProfile } = await supabase
      .from('barber_profiles')
      .select('id')
      .eq('user_id', authData.user.id)
      .single()

    if (!barberProfile) {
      setError('Barber profile not found — try signing up again.')
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase
      .from('barber_profiles')
      .update({
        bio,
        address,
        offers_home_service: offersHomeService,
        service_radius_km: radiusKm,
      })
      .eq('id', barberProfile.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    // Set location via the RPC helper, since PostGIS geography can't be
    // written directly through a plain update() call.
    const { error: locationError } = await supabase.rpc('set_barber_location', {
      p_barber_id: barberProfile.id,
      p_lng: coords.lng,
      p_lat: coords.lat,
    })

    if (locationError) {
      setError(locationError.message)
      setSaving(false)
      return
    }

    router.push('/barber/services')
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <h1 className="text-2xl font-medium mb-1">Set up your barber profile</h1>
      <p className="text-gray-500 mb-6">Customers will see this when they search nearby.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Bio</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell customers what you specialize in"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Shop address</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, area, city"
          />
        </div>

        <div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={captureLocation}
              disabled={locating}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2"
            >
              {locating ? 'Working…' : coords ? 'Location captured ✓' : 'Use my current location'}
            </button>
            <button
              type="button"
              onClick={geocodeAddress}
              disabled={locating}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2"
            >
              Look up address instead
            </button>
          </div>
          {coords && (
            <p className="text-xs text-gray-500 mt-1">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          )}
        </div>

        <div className="border-t border-gray-200 pt-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={offersHomeService}
              onChange={(e) => setOffersHomeService(e.target.checked)}
            />
            I offer home service (I travel to customers)
          </label>

          {offersHomeService && (
            <div className="mt-3">
              <label className="block text-sm text-gray-700 mb-1">
                Travel radius: {radiusKm} km
              </label>
              <input
                type="range"
                min={1}
                max={30}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Home service requires ID verification before it goes live on your profile.
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-brand text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Continue to add services'}
        </button>
      </div>
    </main>
  )
}
