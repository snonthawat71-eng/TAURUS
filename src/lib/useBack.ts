import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * A "back" action that goes to the previous in-app page, but falls back to a
 * given route when there's no in-app history to return to — e.g. the link was
 * opened directly in a fresh browser tab, where `navigate(-1)` would otherwise
 * leave the app entirely. React Router tracks position in `history.state.idx`.
 */
export function useBack(fallback: string) {
  const navigate = useNavigate()
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate(fallback)
  }, [navigate, fallback])
}
