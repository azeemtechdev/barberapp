-- ── Conversations ────────────────────────────────────────────────────
-- One conversation per (customer, barber) pair — not tied to a specific
-- booking, so the thread persists across repeat bookings.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(id) on delete cascade,
  barber_id uuid not null references public.barber_profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (customer_id, barber_id)
);

create index conversations_customer_idx on public.conversations (customer_id);
create index conversations_barber_idx on public.conversations (barber_id);

-- ── Messages ─────────────────────────────────────────────────────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Participants can view their conversations"
  on public.conversations for select using (
    auth.uid() = customer_id
    or auth.uid() in (select user_id from public.barber_profiles where id = barber_id)
  );

create policy "Customers can start a conversation with a barber"
  on public.conversations for insert with check (auth.uid() = customer_id);

create policy "Participants can view messages in their conversations"
  on public.messages for select using (
    conversation_id in (
      select id from public.conversations
      where customer_id = auth.uid()
         or barber_id in (select id from public.barber_profiles where user_id = auth.uid())
    )
  );

create policy "Participants can send messages in their conversations"
  on public.messages for insert with check (
    sender_id = auth.uid()
    and conversation_id in (
      select id from public.conversations
      where customer_id = auth.uid()
         or barber_id in (select id from public.barber_profiles where user_id = auth.uid())
    )
  );

-- Keep last_message_at current so conversation lists can sort by recency
-- without a join + aggregate on every load.
create or replace function public.touch_conversation_on_message()
returns trigger as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_message_insert
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- Conversation participants need to see each other's name for the chat
-- UI — this can happen before any booking exists (e.g. someone messages
-- a barber with a question first), so the earlier booking-based policy
-- on users doesn't cover it.
create policy "Conversation participants can view each other's basic info"
  on public.users for select using (
    id in (
      select customer_id from public.conversations c
      join public.barber_profiles bp on bp.id = c.barber_id
      where bp.user_id = auth.uid()
    )
    or id in (
      select bp.user_id from public.barber_profiles bp
      join public.conversations c on c.barber_id = bp.id
      where c.customer_id = auth.uid()
    )
  );

-- ── Enable Realtime ──────────────────────────────────────────────────
-- This is what lets the frontend subscribe to new rows via websocket
-- instead of polling — included free in Supabase's free tier.
alter publication supabase_realtime add table public.messages;
