'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Search, CalendarDays, User, Scissors, LayoutDashboard, Home, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
}

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [role, setRole] = useState<UserRole | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    async function loadRole(userId: string) {
      const { data } = await supabase.from('users').select('role').eq('id', userId).single()
      setRole(data?.role ?? null)
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setLoggedIn(true)
        loadRole(data.user.id)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user)
      if (session?.user) {
        loadRole(session.user.id)
      } else {
        setRole(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Don't show the bottom nav on auth screens — nothing to navigate to yet
  if (pathname === '/login' || pathname === '/signup') return null

  const items: NavItem[] = loggedIn
    ? role === 'barber'
      ? [
          { href: '/barber/dashboard', label: 'Bookings', icon: LayoutDashboard },
          { href: '/barber/services', label: 'Services', icon: Scissors },
          { href: '/messages', label: 'Messages', icon: MessageCircle },
          { href: '/barber/profile', label: 'Profile', icon: User },
        ]
      : [
          { href: '/search', label: 'Search', icon: Search },
          { href: '/customer/bookings', label: 'Bookings', icon: CalendarDays },
          { href: '/messages', label: 'Messages', icon: MessageCircle },
          { href: '/customer/profile', label: 'Profile', icon: User },
        ]
    : [
        { href: '/', label: 'Home', icon: Home },
        { href: '/search', label: 'Search', icon: Search },
        { href: '/login', label: 'Log in', icon: User },
      ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-md mx-auto flex">
        {items.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs ${
                active ? 'text-brand' : 'text-gray-400'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {item.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
