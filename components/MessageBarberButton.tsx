'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateConversation } from '@/lib/chat'

export default function MessageBarberButton({ barberId }: { barberId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      // Don't show "message this barber" to the barber viewing their own page
      const { data: ownProfile } = await supabase
        .from('barber_profiles')
        .select('id')
        .eq('id', barberId)
        .eq('user_id', authData.user.id)
        .maybeSingle()

      setVisible(!ownProfile)
    }
    check()
  }, [barberId])

  async function handleClick() {
    setLoading(true)
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      router.push('/login')
      return
    }
    try {
      const conversationId = await getOrCreateConversation(authData.user.id, barberId)
      router.push(`/messages/${conversationId}`)
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center justify-center gap-1.5 w-full border border-brand text-brand rounded-lg py-2 text-sm font-medium mb-4 disabled:opacity-50"
    >
      <MessageCircle size={16} />
      {loading ? 'Opening chat…' : 'Message this barber'}
    </button>
  )
}
