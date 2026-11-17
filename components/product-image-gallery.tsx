'use client'

import { useState } from 'react'

type GalleryProduct = {
  name: string
  image: string
  images?: string[]
}

export function ProductImageGallery({ product }: { product: GalleryProduct }) {
  const images = Array.from(new Set([product.image, ...(product.images ?? [])].filter(Boolean)))
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <div className="min-w-0">
      <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl bg-[#F5F5F7]">
        <img src={images[activeIndex] ?? product.image} alt={`${product.name} photo ${activeIndex + 1}`} className="h-full w-full object-contain" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={`${product.name} photos`}>
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show photo ${index + 1} of ${product.name}`}
              aria-pressed={activeIndex === index}
              className={`size-[68px] shrink-0 overflow-hidden rounded-xl border-2 bg-[#F5F5F7] p-1 transition ${activeIndex === index ? 'border-[#0071E3]' : 'border-transparent hover:border-black/15'}`}
            >
              <img src={image} alt="" className="h-full w-full rounded-lg object-contain" />
            </button>
          ))}
        </div>
      )}
      {images.length > 1 && <p className="sr-only" aria-live="polite">Photo {activeIndex + 1} of {images.length}</p>}
    </div>
  )
}
