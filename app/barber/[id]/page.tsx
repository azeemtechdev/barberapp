import { createClient } from '@/lib/supabase/server'
import type { BarberProfile, Service, Review, BarberPortfolioImage } from '@/lib/types'
import BackHeader from '@/components/BackHeader'
import MessageBarberButton from '@/components/MessageBarberButton'

export default async function BarberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: barber } = await supabase
    .from('barber_profiles')
    .select('*')
    .eq('id', id)
    .single<BarberProfile>()

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('barber_id', id)
    .returns<Service[]>()

  const { data: photos } = await supabase
    .from('barber_portfolio_images')
    .select('*')
    .eq('barber_id', id)
    .order('created_at', { ascending: false })
    .returns<BarberPortfolioImage[]>()

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('barber_id', id)
    .order('created_at', { ascending: false })
    .returns<Review[]>()

  if (!barber) {
    return (
      <main className="max-w-md mx-auto px-6 py-12">
        <p>Barber not found.</p>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto px-6 py-8">
      <BackHeader title={barber.address ?? 'Barber'} />
      <div className="flex items-center gap-2 mb-1 -mt-4">
        {barber.is_verified && (
          <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full">
            Verified
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-1">
        ★ {barber.avg_rating.toFixed(1)} {reviews && reviews.length > 0 && `(${reviews.length} review${reviews.length === 1 ? '' : 's'})`}
      </p>

      {photos && photos.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {photos.map((photo) => (
            <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
              <img src={photo.image_url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {barber.bio && <p className="text-gray-700 mb-6">{barber.bio}</p>}

      {barber.offers_home_service && (
        <p className="text-sm text-brand mb-6">
          Offers home service within {barber.service_radius_km} km
          {barber.home_service_verified ? '' : ' (pending verification)'}
        </p>
      )}

      <MessageBarberButton barberId={barber.id} />

      <h2 className="font-medium mb-3">Services</h2>
      <div className="space-y-3 mb-8">
        {(services ?? []).map((s) => (
          <div key={s.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-gray-500">{s.duration_minutes} min · ₦{s.price_naira.toLocaleString()}</p>
            </div>
            <a
              href={`/booking/${s.id}`}
              className="bg-brand text-white text-sm px-3 py-1.5 rounded-lg"
            >
              Book
            </a>
          </div>
        ))}
        {(services ?? []).length === 0 && (
          <p className="text-sm text-gray-400">No services listed yet.</p>
        )}
      </div>

      <h2 className="font-medium mb-3">Reviews</h2>
      <div className="space-y-3">
        {(reviews ?? []).map((r) => (
          <div key={r.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-1 mb-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={n <= r.rating ? 'text-amber-500' : 'text-gray-300'}>
                  ★
                </span>
              ))}
            </div>
            {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
            <p className="text-xs text-gray-400 mt-1">
              {new Date(r.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
        {(reviews ?? []).length === 0 && (
          <p className="text-sm text-gray-400">No reviews yet.</p>
        )}
      </div>
    </main>
  )
}
