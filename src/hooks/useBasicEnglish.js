// Input validation for chat messages.
// Note: we don't pre-process the user's text — the LLM must see exactly what they
// wrote so it can teach naturally (e.g. model simpler vocabulary in its reply).
import { useCallback } from 'react'

export function useBasicEnglish() {
  const validateInput = useCallback((text) => {
    const trimmed = text.trim()
    if (!trimmed) return { valid: false, error: 'Please write something!' }
    if (trimmed.length > 500) return { valid: false, error: 'Message too long. Keep it short!' }
    return { valid: true, error: null }
  }, [])

  return { validateInput }
}
