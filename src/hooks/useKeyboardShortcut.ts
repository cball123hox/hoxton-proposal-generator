import { useEffect } from 'react'

interface Options {
  ctrl?: boolean
  enabled?: boolean
}

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  { ctrl = false, enabled = true }: Options = {}
) {
  useEffect(() => {
    if (!enabled) return

    function handler(e: KeyboardEvent) {
      const modPressed = ctrl ? (e.metaKey || e.ctrlKey) : true
      if (e.key.toLowerCase() === key.toLowerCase() && modPressed) {
        e.preventDefault()
        callback()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [key, callback, ctrl, enabled])
}
