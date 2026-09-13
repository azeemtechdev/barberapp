import { createClient } from '@/lib/supabase/client'

export async function getOrCreateConversation(customerId: string, barberId: string) {
  const supabase = createClient()

  // Try to find an existing conversation first
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_id', customerId)
    .eq('barber_id', barberId)
    .maybeSingle()

  if (existing) return existing.id

  // None yet — create one. Relies on the unique(customer_id, barber_id)
  // constraint; if two requests race, upsert with onConflict resolves it
  // to the same row instead of erroring.
  const { data: created, error } = await supabase
    .from('conversations')
    .upsert(
      { customer_id: customerId, barber_id: barberId },
      { onConflict: 'customer_id,barber_id' }
    )
    .select('id')
    .single()

  if (error) throw error
  return created.id
}
