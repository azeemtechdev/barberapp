'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ConversationRow {
  id: string
  last_message_at: string
  customer_id: string
  barber_id: string
  other_party_name: string
}

export default function MessagesListPage() {
  const supabase = createClient()
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) {
        setLoading(false)
        return
      }

      const { data: barberProfile } = await supabase
        .from('barber_profiles')
        .select('id')
        .eq('user_id', authData.user.id)
        .maybeSingle()

      const { data: rows } = await supabase
        .from('conversations')
        .select(
          `id, last_message_at, customer_id, barber_id,
           customer:customer_id (full_name),
           barber:barber_id (user_id, users:user_id (full_name))`
        )
        .or(
          barberProfile
            ? `customer_id.eq.${authData.user.id},barber_id.eq.${barberProfile.id}`
            : `customer_id.eq.${authData.user.id}`
        )
        .order('last_message_at', { ascending: false })

      const mapped: ConversationRow[] = (rows ?? []).map((r: any) => {
        const isCustomer = r.customer_id === authData.user!.id
        const otherName = isCustomer
          ? r.barber?.users?.full_name ?? 'Barber'
          : r.customer?.full_name ?? 'Customer'
        return {
          id: r.id,
          last_message_at: r.last_message_at,
          customer_id: r.customer_id,
          barber_id: r.barber_id,
          other_party_name: otherName,
        }
      })

      setConversations(mapped)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <main className="max-w-md mx-auto px-6 py-8">Loading…</main>
  }

  return (
    <main className="max-w-md mx-auto px-6 py-8">
      <h1 className="text-xl font-medium mb-6">Messages</h1>

      <div className="space-y-2">
        {conversations.map((c) => (
          <a
            key={c.id}
            href={`/messages/${c.id}`}
            className="block border border-gray-200 rounded-lg p-4 hover:border-brand"
          >
            <div className="flex justify-between items-center">
              <span className="font-medium">{c.other_party_name}</span>
              <span className="text-xs text-gray-400">
                {new Date(c.last_message_at).toLocaleDateString()}
              </span>
            </div>
          </a>
        ))}
        {conversations.length === 0 && (
          <p className="text-sm text-gray-400">
            No conversations yet — message a barber from their profile to start one.
          </p>
        )}
      </div>
    </main>
  )
}
