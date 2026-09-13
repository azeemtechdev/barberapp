export type UserRole = 'customer' | 'barber'

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'completed'
  | 'cancelled_by_customer'
  | 'cancelled_by_barber'
  | 'no_show'

export type LocationType = 'in_shop' | 'home_service'
export type PaymentType = 'deposit' | 'balance' | 'refund'
export type PaymentStatus = 'pending' | 'success' | 'failed'

export interface AppUser {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  created_at: string
}

export interface BarberProfile {
  id: string
  user_id: string
  bio: string | null
  lat: number | null
  lng: number | null
  address: string | null
  offers_home_service: boolean
  service_radius_km: number
  is_verified: boolean
  home_service_verified: boolean
  avg_rating: number
  work_start_time: string // 'HH:MM:SS'
  work_end_time: string
  work_days: number[] // 0 = Sunday ... 6 = Saturday
  created_at: string
}

export interface Service {
  id: string
  barber_id: string
  name: string
  price_naira: number
  duration_minutes: number
  home_service_available: boolean
  home_service_fee: number
  created_at: string
}

export interface Booking {
  id: string
  customer_id: string
  barber_id: string
  service_id: string
  scheduled_time: string
  duration_minutes: number
  location_type: LocationType
  customer_lat: number | null
  customer_lng: number | null
  customer_address: string | null
  total_naira: number
  deposit_amount: number
  status: BookingStatus
  created_at: string
}

export interface Payment {
  id: string
  booking_id: string
  type: PaymentType
  amount_naira: number
  paystack_ref: string | null
  status: PaymentStatus
  paid_at: string | null
}

export interface Review {
  id: string
  booking_id: string
  barber_id: string
  rating: number
  comment: string | null
  created_at: string
}

export interface BarberPortfolioImage {
  id: string
  barber_id: string
  image_url: string
  storage_path: string
  created_at: string
}

export interface Conversation {
  id: string
  customer_id: string
  barber_id: string
  last_message_at: string
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}
