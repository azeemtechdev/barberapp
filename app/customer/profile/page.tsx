'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AppUser } from '@/lib/types'

export default function CustomerProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<AppUser | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
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

      if (userRow) {
        setUser(userRow)
        setFullName(userRow.full_name)
        setPhone(userRow.phone ?? '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    if (!user) return
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: updateError } = await supabase
      .from('users')
      .update({ full_name: fullName, phone })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
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

        <div>
          <label className="block text-sm text-gray-700 mb-1">Email</label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-500"
            value={user?.email ?? ''}
            disabled
          />
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
