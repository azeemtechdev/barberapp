import { Scissors } from 'lucide-react'

export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 relative overflow-hidden bg-gray-50">
      {/* Soft brand-colored glow behind the card — depth without leaning on a generic purple gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full opacity-[0.15] blur-3xl"
        style={{ background: 'radial-gradient(circle, #1a5c4a 0%, transparent 70%)' }}
      />

      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center mb-4 shadow-lg shadow-brand/20">
            <Scissors size={22} className="text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          <p className="text-gray-500 text-sm mt-1 text-center">{subtitle}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {children}
        </div>
      </div>
    </main>
  )
}
