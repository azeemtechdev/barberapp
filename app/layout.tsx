import './globals.css'
import BottomNav from '@/components/BottomNav'

export const metadata = {
  title: 'Barber marketplace',
  description: 'Find and book a barber near you',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="pb-16">
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
