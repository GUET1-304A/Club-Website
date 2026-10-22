import { useState, useEffect, useCallback } from 'react'
import { navigate, NAVIGATION_EVENT } from '../../lib/navigation'

export function useLocation() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    window.addEventListener(NAVIGATION_EVENT, onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener(NAVIGATION_EVENT, onPopState)
    }
  }, [])

  return path
}

export function useNavigate() {
  return useCallback((to: string) => {
    navigate(to)
  }, [])
}
