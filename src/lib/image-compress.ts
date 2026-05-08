'use client'

export type CompressImageOptions = {
  maxWidth: number
  maxHeight?: number
  quality?: number
  outputType?: 'image/jpeg' | 'image/webp'
  maxInputMb?: number
  maxOutputMb?: number
}

export type CompressImageResult = {
  file: File
  originalBytes: number
  compressedBytes: number
  changed: boolean
}

const DEFAULT_MAX_INPUT_MB = 16
const DEFAULT_MAX_OUTPUT_MB = 2.5
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type ImageCompressionErrorCode =
  | 'not_image'
  | 'unsupported_image_type'
  | 'input_too_large'
  | 'output_too_large'
  | 'prepare_failed'
  | 'compress_failed'

export class ImageCompressionError extends Error {
  code: ImageCompressionErrorCode
  limitMb?: number

  constructor(code: ImageCompressionErrorCode, message: string, limitMb?: number) {
    super(message)
    this.name = 'ImageCompressionError'
    this.code = code
    this.limitMb = limitMb
  }
}

export function imageCompressionErrorText(error: unknown, language: 'sl' | 'en' = 'sl') {
  const fallback = language === 'en'
    ? 'The image could not be prepared.'
    : 'Slike ni bilo mogoce pripraviti.'
  if (!(error instanceof ImageCompressionError)) return error instanceof Error ? error.message : fallback

  const limit = error.limitMb
  const messages: Record<ImageCompressionErrorCode, { sl: string, en: string }> = {
    not_image: {
      sl: 'Izbrana datoteka ni slika.',
      en: 'The selected file is not an image.',
    },
    unsupported_image_type: {
      sl: 'Podprte so samo JPG, PNG in WEBP slike.',
      en: 'Only JPG, PNG and WEBP images are supported.',
    },
    input_too_large: {
      sl: `Slika je prevelika. Najvecja dovoljena velikost je ${limit || DEFAULT_MAX_INPUT_MB} MB.`,
      en: `The image is too large. The maximum allowed size is ${limit || DEFAULT_MAX_INPUT_MB} MB.`,
    },
    output_too_large: {
      sl: `Slike ni bilo mogoce dovolj stisniti. Poskusi manjso ali bolj ostro sliko do ${limit || DEFAULT_MAX_OUTPUT_MB} MB.`,
      en: `The image could not be compressed enough. Try a smaller or sharper image up to ${limit || DEFAULT_MAX_OUTPUT_MB} MB.`,
    },
    prepare_failed: {
      sl: 'Slike ni bilo mogoce pripraviti.',
      en: 'The image could not be prepared.',
    },
    compress_failed: {
      sl: 'Slike ni bilo mogoce stisniti.',
      en: 'The image could not be compressed.',
    },
  }
  return messages[error.code]?.[language] || fallback
}

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
      reject(new ImageCompressionError('prepare_failed', 'image_prepare_failed'))
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
  const maxOutputMb = options.maxOutputMb ?? DEFAULT_MAX_OUTPUT_MB
  const maxOutputBytes = maxOutputMb * 1024 * 1024
  if (!file.type.startsWith('image/')) {
    throw new ImageCompressionError('not_image', 'not_image')
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new ImageCompressionError('unsupported_image_type', 'unsupported_image_type')
  }
  if (file.size > maxInputBytes) {
    throw new ImageCompressionError('input_too_large', 'input_too_large', options.maxInputMb ?? DEFAULT_MAX_INPUT_MB)
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
  if (!ctx) throw new ImageCompressionError('prepare_failed', 'image_prepare_failed')
  ctx.drawImage(img, 0, 0, width, height)

  const outputType = options.outputType ?? 'image/jpeg'
  const quality = options.quality ?? 0.78
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, quality))
  if (!blob) throw new ImageCompressionError('compress_failed', 'image_compress_failed')

  if (ratio === 1 && blob.size >= file.size) {
    if (file.size > maxOutputBytes) {
      throw new ImageCompressionError('output_too_large', 'output_too_large', maxOutputMb)
    }
    return { file, originalBytes: file.size, compressedBytes: file.size, changed: false }
  }

  const compressedFile = new File(
    [blob],
    renameWithExtension(file.name, extensionFor(outputType)),
    { type: outputType, lastModified: Date.now() },
  )

  if (compressedFile.size > maxOutputBytes) {
    throw new ImageCompressionError('output_too_large', 'output_too_large', maxOutputMb)
  }

  return {
    file: compressedFile,
    originalBytes: file.size,
    compressedBytes: compressedFile.size,
    changed: true,
  }
}

export const uploadImageProfiles = {
  receipt: { maxWidth: 1200, maxHeight: 1600, quality: 0.78, maxInputMb: 12, maxOutputMb: 1.8 },
  vehicle: { maxWidth: 1600, maxHeight: 1600, quality: 0.82, maxInputMb: 16, maxOutputMb: 2.2 },
  document: { maxWidth: 1400, maxHeight: 1800, quality: 0.8, maxInputMb: 16, maxOutputMb: 2.5 },
} as const
