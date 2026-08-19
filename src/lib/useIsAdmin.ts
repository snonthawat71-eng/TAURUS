import { useTrip } from '@/contexts/TripContext'

/** Whether the signed-in user may edit the curated country pages.
 *
 *  The flag only hides UI — every write is checked again by row-level security,
 *  so a user who forces the route still can't change anything. */
export function useIsAdmin(): boolean {
  return !!useTrip().profile?.is_admin
}
