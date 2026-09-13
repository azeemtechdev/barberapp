/**
 * Compresses an image entirely in the browser before upload: resizes to fit
 * within maxDimension (preserving aspect ratio) and re-encodes as WebP at
 * the given quality. Runs on the canvas API — no server round-trip, no
 * extra dependency, and it keeps Supabase Storage usage far below the free
 * tier's 1GB limit even with lots of barbers uploading photos.
 */
export async function compressImageToWebP(
  file: File,
  maxDimension = 1080,
  quality = 0.8
): Promise<File> {
  const bitmap = await createImageBitmap(file)

  let { width, height } = bitmap
  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas not supported in this browser — uploading original file instead.')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Compression failed'))),
      'image/webp',
      quality
    )
  })

  // Preserve the original filename minus extension, force .webp
  const baseName = file.name.replace(/\.[^/.]+$/, '')
  return new File([blob], `${baseName}.webp`, { type: 'image/webp' })
}
