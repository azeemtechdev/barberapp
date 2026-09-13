'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useConversationMessages } from '@/lib/hooks/useConversationMessages'
import BackHeader from '@/components/BackHeader'

export default function ConversationThreadPage() {
  const params = useParams<{ conversationId: string }>()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [otherPartyName, setOtherPartyName] = useState('Chat')
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, loading, error, sendMessage } = useConversationMessages(
    params.conversationId
  )

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return
      setUserId(authData.user.id)

      const { data: convo } = await supabase
        .from('conversations')
        .select(
          `customer_id, barber_id,
           customer:customer_id (full_name),
           barber:barber_id (user_id, users:user_id (full_name))`
        )
        .eq('id', params.conversationId)
        .single()

      if (convo) {
        const isCustomer = (convo as any).customer_id === authData.user.id
        setOtherPartyName(
          isCustomer
            ? (convo as any).barber?.users?.full_name ?? 'Barber'
            : (convo as any).customer?.full_name ?? 'Customer'
        )
      }
    }
    load()
  }, [params.conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !draft.trim()) return
    sendMessage(userId, draft)
    setDraft('')
  }

  return (
    <main className="max-w-md mx-auto px-6 py-8 flex flex-col h-[calc(100vh-4rem)]">
      <BackHeader title={otherPartyName} />

      <div className="flex-1 overflow-y-auto space-y-2 pb-4">
        {loading && <p className="text-sm text-gray-400">Loading messages…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {messages.map((m) => {
          const isMine = m.sender_id === userId
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  isMine ? 'bg-brand text-white' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {m.body}
              </div>
            </div>
          )
        })}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-gray-400">Say hello 👋</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-gray-200 pt-3">
        <input
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm"
          placeholder="Type a message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="submit"
          className="bg-brand text-white rounded-full p-2.5 disabled:opacity-50"
          disabled={!draft.trim()}
        >
          <Send size={16} />
        </button>
      </form>
    </main>
  )
}
