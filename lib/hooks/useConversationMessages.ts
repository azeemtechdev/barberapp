import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Message } from '@/lib/types'

/**
 * Realtime chat for a single conversation.
 *
 * How the realtime part works: Supabase's Realtime service listens to
 * Postgres's own replication stream (this is enabled per-table via
 * `alter publication supabase_realtime add table messages` in the
 * migration). When any client inserts a row into `messages`, Postgres
 * replicates that change, Supabase's Realtime server picks it up and
 * pushes it down every open websocket subscribed to this conversation —
 * including the sender's own browser. That's why sendMessage() below
 * doesn't manually append to local state: the row comes back through the
 * same subscription a moment later, so every client (sender and
 * recipient) ends up with one consistent source of truth instead of two
 * slightly different local copies.
 *
 * This is included in Supabase's free tier — no separate realtime service
 * (Pusher, Ably, etc.) or extra cost needed.
 */
export function useConversationMessages(conversationId: string | null) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!conversationId) return

    let cancelled = false
    setLoading(true)

    async function loadHistory() {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (fetchError) setError(fetchError.message)
      else setMessages(data ?? [])
      setLoading(false)
    }
    loadHistory()

    // Subscribe to new messages in this conversation. The filter means
    // this browser only receives inserts relevant to this thread, not
    // every message on the whole platform.
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Guard against duplicates in case of a reconnect replay
            if (prev.some((m) => m.id === (payload.new as Message).id)) return prev
            return [...prev, payload.new as Message]
          })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  async function sendMessage(senderId: string, body: string) {
    if (!conversationId || !body.trim()) return
    const { error: sendError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: body.trim(),
    })
    if (sendError) setError(sendError.message)
    // No local state update here on purpose — see the comment above the
    // hook. The realtime subscription delivers the row back to us.
  }

  return { messages, loading, error, sendMessage }
}
