'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, X, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { compressImageToWebP } from '@/lib/imageCompression'
import type { AppUser, BarberProfile, BarberPortfolioImage } from '@/lib/types'

const MAX_PORTFOLIO_PHOTOS = 6

export default function BarberProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<AppUser | null>(null)
  const [barber, setBarber] = useState<BarberProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [address, setAddress] = useState('')
  const [offersHomeService, setOffersHomeService] = useState(false)
  const [radiusKm, setRadiusKm] = useState(5)
  const [workStart, setWorkStart] = useState('09:00')
  const [workEnd, setWorkEnd] = useState('18:00')
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const [photos, setPhotos] = useState<BarberPortfolioImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) {
        router.push('/login')
        return
      }

      const { data: userRow } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single()

      const { data: barberRow } = await supabase
        .from('barber_profiles')
        .select('*')
        .eq('user_id', authData.user.id)
        .single()

      if (userRow) {
        setUser(userRow)
        setFullName(userRow.full_name)
        setPhone(userRow.phone ?? '')
      }
      if (barberRow) {
        setBarber(barberRow)
        setBio(barberRow.bio ?? '')
        setAddress(barberRow.address ?? '')
        setOffersHomeService(barberRow.offers_home_service)
        setRadiusKm(barberRow.service_radius_km ?? 5)
        setWorkStart((barberRow.work_start_time ?? '09:00:00').slice(0, 5))
        setWorkEnd((barberRow.work_end_time ?? '18:00:00').slice(0, 5))
        setWorkDays(barberRow.work_days ?? [1, 2, 3, 4, 5, 6])

        const { data: photoRows } = await supabase
          .from('barber_portfolio_images')
          .select('*')
          .eq('barber_id', barberRow.id)
          .order('created_at', { ascending: false })
        setPhotos(photoRows ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    if (!user || !barber) return
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: userError } = await supabase
      .from('users')
      .update({ full_name: fullName, phone })
      .eq('id', user.id)

    const { error: barberError } = await supabase
      .from('barber_profiles')
      .update({
        bio,
        address,
        offers_home_service: offersHomeService,
        service_radius_km: radiusKm,
        work_start_time: workStart,
        work_end_time: workEnd,
        work_days: workDays,
      })
      .eq('id', barber.id)

    if (userError || barberError) {
      setError(userError?.message ?? barberError?.message ?? 'Could not save changes.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !barber) return

    if (photos.length >= MAX_PORTFOLIO_PHOTOS) {
      setError(`You can upload up to ${MAX_PORTFOLIO_PHOTOS} photos — delete one to add another.`)
      e.target.value = ''
      return
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('Photo must be under 15MB before compression.')
      e.target.value = ''
      return
    }

    setUploading(true)
    setError(null)

    let compressed: File
    try {
      // Resize + convert to WebP entirely in the browser before it ever
      // touches the network — keeps storage usage low and uploads fast,
      // especially useful on the slower mobile connections a lot of
      // barbers and customers will be using.
      compressed = await compressImageToWebP(file, 1080, 0.8)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process that image.')
      setUploading(false)
      e.target.value = ''
      return
    }

    const path = `${barber.id}/${crypto.randomUUID()}.webp`

    const { error: uploadError } = await supabase.storage
      .from('barber-portfolios')
      .upload(path, compressed, { contentType: 'image/webp' })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('barber-portfolios').getPublicUrl(path)

    const { data: newPhoto, error: insertError } = await supabase
      .from('barber_portfolio_images')
      .insert({
        barber_id: barber.id,
        image_url: urlData.publicUrl,
        storage_path: path,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
    } else if (newPhoto) {
      setPhotos((prev) => [newPhoto, ...prev])
    }

    setUploading(false)
    e.target.value = '' // allow re-selecting the same file later
  }

  async function handlePhotoDelete(photo: BarberPortfolioImage) {
    await supabase.storage.from('barber-portfolios').remove([photo.storage_path])
    await supabase.from('barber_portfolio_images').delete().eq('id', photo.id)
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return <main className="max-w-md mx-auto px-6 py-8">Loading…</main>
  }

  return (
    <main className="max-w-md mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Your profile</h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>

      {barber && (
        <a
          href={`/barber/${barber.id}`}
          className="block text-sm text-brand mb-6 border border-brand/20 bg-brand/5 rounded-lg px-3 py-2"
        >
          View your public profile →
        </a>
      )}

      <div className="mb-6">
        <label className="block text-sm text-gray-700 mb-2">
          Portfolio photos ({photos.length}/{MAX_PORTFOLIO_PHOTOS})
          <span className="text-gray-400 font-normal block text-xs mt-0.5">
            This is what actually builds trust — add a few of your best cuts.
          </span>
        </label>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden group">
              <img src={photo.image_url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => handlePhotoDelete(photo)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                aria-label="Delete photo"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PORTFOLIO_PHOTOS && (
            <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-brand hover:text-brand">
              <Upload size={18} />
              <span className="text-xs mt-1">{uploading ? 'Uploading…' : 'Add'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
            </label>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Full name</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Phone</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="border-t border-gray-200 pt-4">
          <label className="block text-sm text-gray-700 mb-1">Bio</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Shop address</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            To move your pinned location, use the onboarding flow again — this only updates the
            displayed address text.
          </p>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <label className="block text-sm text-gray-700 mb-2">Working days</label>
          <div className="flex gap-1.5">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, dow) => {
              const active = workDays.includes(dow)
              return (
                <button
                  key={dow}
                  type="button"
                  onClick={() =>
                    setWorkDays((prev) =>
                      active ? prev.filter((d) => d !== dow) : [...prev, dow].sort()
                    )
                  }
                  className={`w-9 h-9 rounded-full text-sm border ${
                    active ? 'bg-brand text-white border-brand' : 'border-gray-300 text-gray-500'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="flex gap-3 mt-3">
            <div className="flex-1">
              <label className="block text-sm text-gray-700 mb-1">Opens</label>
              <input
                type="time"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-700 mb-1">Closes</label>
              <input
                type="time"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Customers can only book during these hours — this is what actually prevents double bookings.
          </p>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={offersHomeService}
              onChange={(e) => setOffersHomeService(e.target.checked)}
            />
            I offer home service
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
              {barber && !barber.home_service_verified && (
                <p className="text-xs text-amber-600 mt-1">
                  Pending verification — home service won't appear in search until approved.
                </p>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-brand">Saved ✓</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-brand text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </main>
  )
}
