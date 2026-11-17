import type { User } from '@supabase/supabase-js'

export function hasAdminAccess(user: User | null | undefined, approvedUserId: string | undefined) {
  return Boolean(approvedUserId && user?.id === approvedUserId)
}
