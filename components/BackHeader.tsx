'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

export default function BackHeader({ title }: { title: string }) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-1 mb-6 -ml-2">
      <button
        onClick={() => router.back()}
        className="p-2 text-gray-500 hover:text-gray-800"
        aria-label="Go back"
      >
        <ChevronLeft size={22} />
      </button>
      <h1 className="text-lg font-medium">{title}</h1>
    </div>
  )
}
