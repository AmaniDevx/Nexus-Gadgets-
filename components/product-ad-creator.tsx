'use client'

import { useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, Megaphone, X } from 'lucide-react'
import { WHATSAPP_BUSINESS_DISPLAY } from '@/lib/whatsapp'

type AdProduct = {
  id: string
  name: string
  category: string
  brand?: string
  price: number
  condition: string
  summary: string
  image: string
  specs: Record<string, string>
}

type ProductAdCreatorProps = {
  products: AdProduct[]
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  let truncated = false

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line)
      if (lines.length === maxLines) {
        truncated = true
        break
      }
      line = word
    } else {
      line = candidate
    }
  }

  if (line && lines.length < maxLines) lines.push(line)
  if (truncated && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1]}…`
  lines.forEach((value, index) => context.fillText(value, x, y + index * lineHeight))
  return y + lines.length * lineHeight
}

function drawImageContain(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight)
  const drawnWidth = image.naturalWidth * scale
  const drawnHeight = image.naturalHeight * scale
  context.drawImage(image, x + (width - drawnWidth) / 2, y + (height - drawnHeight) / 2, drawnWidth, drawnHeight)
}

function getAdSpecs(product: AdProduct) {
  const find = (pattern: RegExp) => Object.entries(product.specs || {}).find(([label]) => pattern.test(label))
  return [find(/processor|cpu|chip/i), find(/ram|memory/i), find(/storage|ssd/i), find(/display|feature|touch|convertib|keyboard/i), find(/graphics|best suited|use case/i)]
    .filter((entry): entry is [string, string] => Boolean(entry))
}

function createAdCanvas(context: CanvasRenderingContext2D, product: AdProduct, image: HTMLImageElement) {
  const canvas = context.canvas
  canvas.width = 1080
  canvas.height = 1920

  context.fillStyle = '#f4f3ef'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#1d1d1f'
  context.font = '700 30px Arial, sans-serif'
  context.fillText('NEXUS GADGETS', 56, 68)
  context.textAlign = 'right'
  context.fillStyle = '#6e6e73'
  context.font = '500 18px Arial, sans-serif'
  context.fillText('THOUGHTFUL TECH · KENYA', 1024, 67)
  context.textAlign = 'left'

  context.fillStyle = '#e8e7e3'
  context.beginPath()
  context.roundRect(36, 100, 1008, 1110, 32)
  context.fill()
  drawImageContain(context, image, 60, 118, 960, 1074)

  context.fillStyle = '#1d1d1f'
  context.beginPath()
  context.roundRect(640, 182, 376, 150, 24)
  context.fill()
  context.fillStyle = '#a9d9bd'
  context.font = '700 17px Arial, sans-serif'
  context.fillText('AVAILABLE NOW', 670, 221)
  context.fillStyle = '#ffffff'
  context.font = '700 40px Arial, sans-serif'
  drawWrappedText(context, `KES ${product.price.toLocaleString('en-KE')}`, 670, 276, 316, 46, 1)

  context.fillStyle = '#0071e3'
  context.font = '700 18px Arial, sans-serif'
  context.fillText(`${product.category.toUpperCase()}  ·  ${product.condition.toUpperCase()}`, 64, 1248)

  context.fillStyle = '#1d1d1f'
  context.font = '700 56px Arial, sans-serif'
  const nameBottom = drawWrappedText(context, product.name, 64, 1312, 952, 64, 2)

  context.fillStyle = '#6e6e73'
  context.font = '400 24px Arial, sans-serif'
  drawWrappedText(context, product.summary, 64, nameBottom + 8, 952, 32, 1)

  const findSpec = (patterns: RegExp[]) => Object.entries(product.specs || {}).find(([label]) => patterns.some(pattern => pattern.test(label)))
  const processor = findSpec([/processor|cpu|chip/i])
  const ram = findSpec([/ram|memory/i])
  const storage = findSpec([/storage|ssd/i])
  const features = findSpec([/display|feature|touch|convertib|keyboard/i])
  const specs = [processor, ram, storage, features, findSpec([/graphics/i]), findSpec([/best suited|use case|recommended use/i])].filter((entry): entry is [string, string] => Boolean(entry))
  const specTop = 1485
  specs.forEach(([label, value], index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = column === 0 ? 64 : 548
    const y = specTop + row * 78
    context.fillStyle = '#86868b'
    context.font = '700 15px Arial, sans-serif'
    context.fillText(label.toUpperCase(), x, y)
    context.fillStyle = '#1d1d1f'
    context.font = '500 22px Arial, sans-serif'
    drawWrappedText(context, value, x, y + 29, 440, 25, 1)
  })

  context.fillStyle = '#1d1d1f'
  context.beginPath()
  context.roundRect(36, 1740, 1008, 134, 28)
  context.fill()
  context.fillStyle = '#a9d9bd'
  context.font = '700 20px Arial, sans-serif'
  context.fillText('ORDER ON WHATSAPP', 68, 1792)
  context.fillStyle = '#ffffff'
  context.font = '500 25px Arial, sans-serif'
  context.fillText(WHATSAPP_BUSINESS_DISPLAY, 68, 1836)
  context.textAlign = 'right'
  context.fillStyle = '#ffffff'
  context.font = '500 18px Arial, sans-serif'
  context.fillText('NEXUS GADGETS · KENYA', 1012, 1814)
  context.textAlign = 'left'
}

export function ProductAdCreator({ products }: ProductAdCreatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? '')
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const selectedProduct = useMemo(
    () => products.find(product => product.id === selectedId) ?? products[0],
    [products, selectedId],
  )

  async function generateAd() {
    if (!selectedProduct || !canvasRef.current) return
    setError('')
    setGenerated(false)

    try {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.src = selectedProduct.image
      await image.decode()

      const context = canvasRef.current.getContext('2d')
      if (!context) throw new Error('canvas_unavailable')
      createAdCanvas(context, selectedProduct, image)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasRef.current?.toBlob(result => result ? resolve(result) : reject(new Error('image_export_failed')), 'image/png')
      })

      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `${selectedProduct.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-nexus-ad.png`
      link.href = downloadUrl
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
      setGenerated(true)
    } catch {
      setError('This product image could not be exported. Try a publicly accessible image URL or upload the image again.')
    }
  }

  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-[#F5F5F7] p-4">
      <div>
        <p className="font-medium">Ready-to-share product creative</p>
        <p className="mt-1 text-xs text-[#6E6E73]">Create a full-screen 1080 × 1920 PNG for WhatsApp Status and TikTok, with a large product photo, specs, price, and WhatsApp contact.</p>
      </div>
      <button type="button" onClick={() => setIsOpen(true)} disabled={!products.length} className="inline-flex items-center gap-2 rounded-full bg-[#1D1D1F] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"><Megaphone size={16}/> Create product ad</button>
    </div>

    {isOpen&&<div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 motion-overlay sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) setIsOpen(false) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="product-ad-title" className="motion-panel max-h-[94dvh] w-full max-w-[1060px] overflow-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[#1D1D1F] shadow-2xl sm:max-h-[94vh] sm:rounded-3xl sm:p-5 md:p-7">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#0071E3]">Marketing studio · Social portrait</p>
            <h2 id="product-ad-title" className="mt-1 text-2xl font-semibold tracking-tight">Create a product ad</h2>
            <p className="mt-1 text-sm text-[#6E6E73]">Choose a catalog item, review the creative, then download a high-resolution PNG.</p>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} aria-label="Close product ad creator" className="rounded-full bg-[#F5F5F7] p-2 text-[#626267] hover:bg-[#e9e9eb]"><X size={18}/></button>
        </header>

        {!selectedProduct ? <p className="rounded-2xl bg-[#F5F5F7] p-6 text-sm text-[#6E6E73]">Add a product to your catalog before creating an ad.</p> : <div className="grid gap-6 lg:grid-cols-[minmax(250px,0.8fr)_minmax(340px,1.2fr)]">
          <div className="flex flex-col gap-4">
            <label htmlFor="ad-product" className="flex flex-col gap-2 text-sm font-medium">Product
              <select id="ad-product" value={selectedProduct.id} onChange={event => { setSelectedId(event.target.value); setGenerated(false); setError('') }} className="rounded-xl bg-[#F5F5F7] px-4 py-3 outline-none focus:ring-2 focus:ring-[#0071E3]">
                {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <div className="rounded-2xl bg-[#F5F5F7] p-4">
              <p className="text-xs font-medium uppercase tracking-[.12em] text-[#86868B]">Included in the ad</p>
              <p className="mt-3 font-semibold">{selectedProduct.name}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">KES {selectedProduct.price.toLocaleString('en-KE')}</p>
              <p className="mt-1 text-sm text-[#6E6E73]">{selectedProduct.condition} · {selectedProduct.category}</p>
              <p className="mt-3 text-sm leading-6 text-[#626267]">{selectedProduct.summary}</p>
              <ul className="mt-3 flex flex-col gap-2 border-t border-black/5 pt-3 text-sm">
                {Object.entries(selectedProduct.specs).slice(0, 4).map(([label, value]) => <li key={label} className="flex justify-between gap-3"><span className="text-[#86868B]">{label}</span><span className="text-right font-medium">{value}</span></li>)}
              </ul>
            </div>
            <p className="text-xs leading-5 text-[#86868B]">The exported image is 1080 × 1920 px in full-screen 9:16 portrait, ready for WhatsApp Status and TikTok. The poster includes WhatsApp Business contact {WHATSAPP_BUSINESS_DISPLAY}.</p>
            {error&&<p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            {generated&&<p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">Ad downloaded. You can change the product and export another version.</p>}
            <button type="button" onClick={() => void generateAd()} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0071E3] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#0077ED]"><ArrowDownToLine size={16}/> Generate &amp; download PNG</button>
          </div>

          <div className="mx-auto w-full max-w-[390px]">
            <p className="mb-2 text-xs font-medium uppercase tracking-[.12em] text-[#86868B]">Live preview</p>
            <article className="flex aspect-[9/16] flex-col overflow-hidden rounded-[26px] bg-[#f4f3ef] shadow-[0_12px_36px_rgba(0,0,0,0.12)]">
              <div className="flex shrink-0 items-center justify-between px-4 pt-4 text-[10px] font-bold tracking-[.1em]"><span>NEXUS GADGETS</span><span className="text-[#6E6E73]">THOUGHTFUL TECH · KENYA</span></div>
              <div className="relative m-3 grid min-h-0 flex-[1.4] place-items-center overflow-hidden rounded-2xl bg-[#e8e7e3] p-3"><img src={selectedProduct.image} alt={`${selectedProduct.name} ad preview`} className="max-h-full max-w-full object-contain"/><div className="absolute right-3 top-3 rounded-2xl bg-[#1D1D1F] px-4 py-3 text-right text-white shadow-lg"><p className="text-[9px] font-bold tracking-wide text-[#a9d9bd]">AVAILABLE NOW</p><p className="mt-1 text-lg font-bold tabular-nums">KES {selectedProduct.price.toLocaleString('en-KE')}</p></div></div>
              <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-1">
                <p className="text-[10px] font-bold tracking-[.08em] text-[#0071E3]">{selectedProduct.category.toUpperCase()} · {selectedProduct.condition.toUpperCase()}</p>
                <h3 className="mt-2 line-clamp-2 text-xl font-bold leading-tight">{selectedProduct.name}</h3>
                <p className="mt-1 line-clamp-1 text-xs text-[#6E6E73]">{selectedProduct.summary}</p>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                  {getAdSpecs(selectedProduct).map(([label, value]) => <div key={label} className="min-w-0"><p className="truncate text-[9px] font-bold tracking-wide text-[#86868B]">{label.toUpperCase()}</p><p className="truncate text-[11px] font-medium">{value}</p></div>)}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-[#1D1D1F] px-4 py-3 text-white"><div><p className="text-[9px] font-bold tracking-wide text-[#a9d9bd]">ORDER ON WHATSAPP</p><p className="mt-1 text-sm font-semibold">{WHATSAPP_BUSINESS_DISPLAY}</p></div><p className="text-[10px] text-white/75">Message us to reserve</p></div>
              </div>
            </article>
          </div>
        </div>}
        <canvas ref={canvasRef} className="sr-only" aria-hidden="true"/>
      </section>
    </div>}
  </>
}
