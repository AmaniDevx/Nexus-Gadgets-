export const WHATSAPP_BUSINESS_PHONE = '254702813154'
export const WHATSAPP_BUSINESS_DISPLAY = '+254 702 813 154'

export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/${WHATSAPP_BUSINESS_PHONE}?text=${encodeURIComponent(message)}`
}
