'use client'

export type CompressImageOptions = {
  maxWidth: number
  maxHeight?: number
  quality?: number
  outputType?: 'image/jpeg' | 'image/webp'
  maxInputMb?: number
}

export type CompressImageResult = {
  file: File
  originalBytes: number
  compressedBytes: number
  changed: boolean
}

const DEFAULT_MAX_INPUT_MB = 16

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Slike ni bilo mogoce pripraviti.'))
    }
    img.src = url
  })

const extensionFor = (mimeType: string) => (mimeType === 'image/webp' ? 'webp' : 'jpg')

const renameWithExtension = (name: string, extension: string) => {
  const cleanName = name.replace(/\.[^.]+$/, '')
  return `${cleanName || 'slika'}.${extension}`
}

export async function compressImageFile(
  file: File,
  options: CompressImageOptions,
): Promise<CompressImageResult> {
  const maxInputBytes = (options.maxInputMb ?? DEFAULT_MAX_INPUT_MB) * 1024 * 1024
  if (!file.type.startsWith('image/')) {
    return { file, originalBytes: file.size, compressedBytes: file.size, changed: false }
  }
  if (file.size > maxInputBytes) {
    throw new Error(`Slika je prevelika. Najvecja dovoljena velikost je ${options.maxInputMb ?? DEFAULT_MAX_INPUT_MB} MB.`)
  }

  const img = await loadImage(file)
  const maxWidth = options.maxWidth
  const maxHeight = options.maxHeight ?? options.maxWidth
  const ratio = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight)
  const width = Math.max(1, Math.round(img.naturalWidth * ratio))
  const height = Math.max(1, Math.round(img.naturalHeight * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Slike ni bilo mogoce pripraviti.')
  ctx.drawImage(img, 0, 0, width, height)

  const outputType = options.outputType ?? 'image/jpeg'
  const quality = options.quality ?? 0.78
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, quality))
  if (!blob) throw new Error('Slike ni bilo mogoce stisniti.')

  if (ratio === 1 && blob.size >= file.size) {
    return { file, originalBytes: file.size, compressedBytes: file.size, changed: false }
  }

  const compressedFile = new File(
    [blob],
    renameWithExtension(file.name, extensionFor(outputType)),
    { type: outputType, lastModified: Date.now() },
  )

  return {
    file: compressedFile,
    originalBytes: file.size,
    compressedBytes: compressedFile.size,
    changed: true,
  }
}

export const uploadImageProfiles = {
  receipt: { maxWidth: 1200, maxHeight: 1600, quality: 0.78, maxInputMb: 16 },
  vehicle: { maxWidth: 1600, maxHeight: 1600, quality: 0.82, maxInputMb: 20 },
  document: { maxWidth: 1400, maxHeight: 1800, quality: 0.8, maxInputMb: 20 },
} as const
