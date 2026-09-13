import { Search, CalendarCheck, Scissors as ScissorsIcon, ShieldCheck } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="max-w-md mx-auto">
      {/* Hero */}
      <div className="relative h-[52vh] min-h-[360px] overflow-hidden">
        <img
          src="https://images.pexels.com/photos/7697225/pexels-photo-7697225.jpeg?auto=compress&cs=tinysrgb&w=1200"
          alt="A barber giving a client a fresh haircut"
          className="w-full h-full object-cover"
        />
        {/* Gradient overlay: brand-tinted at the bottom fading to transparent,
            so the headline is legible against any photo without just slapping
            plain black underneath it */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(15,61,49,0.92) 0%, rgba(15,61,49,0.55) 35%, rgba(15,61,49,0.05) 70%, transparent 100%)',
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-8">
          <h1 className="text-3xl font-semibold text-white leading-tight mb-2">
            Book a barber near you
          </h1>
          <p className="text-white/85 text-sm">
            In-shop or at home. Pay a small deposit to lock in your slot — no more back-and-forth.
          </p>
        </div>
      </div>

      {/* CTAs */}
      <div className="px-6 pt-6 pb-8 space-y-3">
        <a
          href="/search"
          className="block text-center bg-brand hover:bg-brand-dark transition-colors text-white rounded-xl py-3 font-medium shadow-sm"
        >
          Find a barber
        </a>
        <a
          href="/signup"
          className="block text-center border border-gray-300 rounded-xl py-3 font-medium text-gray-800"
        >
          Sign up as a customer or barber
        </a>
        <a href="/login" className="block text-center text-sm text-gray-500 pt-1">
          Already have an account? <span className="text-brand font-medium">Log in</span>
        </a>
      </div>

      {/* How it works */}
      <div className="px-6 py-8 border-t border-gray-100">
        <h2 className="text-lg font-medium text-gray-900 mb-5">How it works</h2>
        <div className="space-y-5">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
              <Search size={18} className="text-brand" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Find a barber nearby</p>
              <p className="text-sm text-gray-500">
                Search by location and see real portfolios, ratings, and reviews.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
              <CalendarCheck size={18} className="text-brand" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Book an open slot</p>
              <p className="text-sm text-gray-500">
                Pick a real available time — in-shop or have them come to you.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
              <ScissorsIcon size={18} className="text-brand" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Get your cut</p>
              <p className="text-sm text-gray-500">
                A small deposit holds your slot — pay the rest in person after.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trust strip */}
      <div className="px-6 pb-10">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
          <ShieldCheck size={18} className="text-brand flex-shrink-0" />
          <p className="text-xs text-gray-600">
            Verified barbers, secure deposit payments, real reviews from real customers.
          </p>
        </div>
      </div>
    </main>
  )
}