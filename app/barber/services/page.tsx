'use client'

import { useEffect, useState } from 'react'
import { Pencil, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Service } from '@/lib/types'
import BackHeader from '@/components/BackHeader'

type DraftService = {
  name: string
  price: string
  duration: string
  homeAvailable: boolean
  homeFee: string
}

const emptyDraft: DraftService = {
  name: '',
  price: '',
  duration: '30',
  homeAvailable: false,
  homeFee: '',
}

export default function BarberServicesPage() {
  const supabase = createClient()

  const [barberId, setBarberId] = useState<string | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [draft, setDraft] = useState<DraftService>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
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
    setBarberId(barber.id)

    const { data: existingServices } = await supabase
      .from('services')
      .select('*')
      .eq('barber_id', barber.id)
      .order('created_at')

    setServices(existingServices ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function startEdit(s: Service) {
    setEditingId(s.id)
    setDraft({
      name: s.name,
      price: String(s.price_naira),
      duration: String(s.duration_minutes),
      homeAvailable: s.home_service_available,
      homeFee: String(s.home_service_fee),
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(emptyDraft)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!barberId || !draft.name || !draft.price) {
      setError('Fill in a name and price.')
      return
    }

    setSaving(true)

    const payload = {
      name: draft.name,
      price_naira: Number(draft.price),
      duration_minutes: Number(draft.duration),
      home_service_available: draft.homeAvailable,
      home_service_fee: draft.homeAvailable ? Number(draft.homeFee || 0) : 0,
    }

    if (editingId) {
      const { data, error: updateError } = await supabase
        .from('services')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single()

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }
      setServices((prev) => prev.map((s) => (s.id === editingId ? data : s)))
      cancelEdit()
    } else {
      const { data, error: insertError } = await supabase
        .from('services')
        .insert({ barber_id: barberId, ...payload })
        .select()
        .single()

      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }
      setServices((prev) => [...prev, data])
      setDraft(emptyDraft)
    }

    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this service? Existing bookings for it are unaffected.')) return
    await supabase.from('services').delete().eq('id', id)
    setServices((prev) => prev.filter((s) => s.id !== id))
    if (editingId === id) cancelEdit()
  }

  if (loading) {
    return <main className="max-w-md mx-auto px-6 py-8">Loading…</main>
  }

  return (
    <main className="max-w-md mx-auto px-6 py-8">
      <BackHeader title="Your services" />

      <div className="space-y-3 mb-8">
        {services.map((s) => (
          <div key={s.id} className="border border-gray-200 rounded-lg p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-gray-500">
                  {s.duration_minutes} min · ₦{s.price_naira.toLocaleString()}
                  {s.home_service_available && ` · home service +₦${s.home_service_fee.toLocaleString()}`}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEdit(s)}
                  className="p-1.5 text-gray-400 hover:text-brand"
                  aria-label="Edit service"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600"
                  aria-label="Delete service"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {services.length === 0 && (
          <p className="text-sm text-gray-400">No services added yet — add your first one below.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{editingId ? 'Edit service' : 'Add a service'}</h2>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Service name</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Skin fade"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm text-gray-700 mb-1">Price (₦)</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-700 mb-1">Duration (min)</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              value={draft.duration}
              onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={draft.homeAvailable}
            onChange={(e) => setDraft({ ...draft, homeAvailable: e.target.checked })}
          />
          Available for home service
        </label>

        {draft.homeAvailable && (
          <div>
            <label className="block text-sm text-gray-700 mb-1">Home service fee (₦)</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              value={draft.homeFee}
              onChange={(e) => setDraft({ ...draft, homeFee: e.target.value })}
              placeholder="Added on top of the base price"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add service'}
        </button>
      </form>
    </main>
  )
}
