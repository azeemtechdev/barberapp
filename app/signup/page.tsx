'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Mail, Phone, Lock, Loader2, Scissors, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthLayout from '@/components/AuthLayout'
import AuthField from '@/components/AuthField'
import type { UserRole } from '@/lib/types'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [role, setRole] = useState<UserRole>('customer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!fullName || !email || !password) {
      setError('Fill in your name, email, and password.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Something went wrong. Try again.')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('users').insert({
      id: data.user.id,
      full_name: fullName,
      email,
      phone: phone || null,
      role,
    })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    if (role === 'barber') {
      const { error: barberError } = await supabase.from('barber_profiles').insert({
        user_id: data.user.id,
      })
      if (barberError) {
        setError(barberError.message)
        setLoading(false)
        return
      }
      router.push('/barber/onboarding')
    } else {
      router.push('/search')
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Book a barber, or list your own services">
      {/* Animated segmented control instead of two plain buttons */}
      <div className="relative flex bg-gray-100 rounded-xl p-1 mb-6">
        <div
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-transform duration-200 ease-out"
          style={{ transform: role === 'barber' ? 'translateX(calc(100% + 8px))' : 'translateX(0)' }}
        />
        <button
          type="button"
          onClick={() => setRole('customer')}
          className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg z-10 transition-colors ${
            role === 'customer' ? 'text-brand' : 'text-gray-500'
          }`}
        >
          <UserRound size={15} /> Customer
        </button>
        <button
          type="button"
          onClick={() => setRole('barber')}
          className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg z-10 transition-colors ${
            role === 'barber' ? 'text-brand' : 'text-gray-500'
          }`}
        >
          <Scissors size={15} /> Barber
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          label="Full name"
          value={fullName}
          onChange={setFullName}
          placeholder="Your name"
          icon={User}
          autoComplete="name"
        />
        <AuthField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          icon={Mail}
          autoComplete="email"
        />
        <AuthField
          label="Phone"
          value={phone}
          onChange={setPhone}
          placeholder="080..."
          icon={Phone}
          autoComplete="tel"
        />
        <AuthField
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 6 characters"
          icon={Lock}
          autoComplete="new-password"
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand hover:bg-brand-dark transition-colors text-white rounded-xl py-2.5 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Creating account…' : `Sign up as a ${role}`}
        </button>
      </form>

      <p className="text-sm text-gray-500 mt-6 text-center">
        Already have an account?{' '}
        <a href="/login" className="text-brand font-medium hover:underline">
          Log in
        </a>
      </p>
    </AuthLayout>
  )
}
