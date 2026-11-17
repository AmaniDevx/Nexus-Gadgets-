import type { User } from '@supabase/supabase-js'

export const APPROVED_ADMIN_EMAIL = 'lewalucas86@gmail.com'

export function hasAdminAccess(user: User | null | undefined, approvedUserId: string | undefined) {
  return Boolean(
    approvedUserId &&
    user?.id === approvedUserId &&
    user.email?.trim().toLowerCase() === APPROVED_ADMIN_EMAIL,
  )
}
