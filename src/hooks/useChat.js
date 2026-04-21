// Hook principal: maneja mensajes, estado y llamadas a la Groq API
import { useState, useCallback, useRef, useEffect } from 'react'
import { getSystemPrompt } from '../config/languages'

// En producción usamos la función serverless de Vercel (key segura en servidor)
// En local llamamos a Groq directamente con VITE_GROQ_API_KEY
const IS_PROD = import.meta.env.PROD
const GROQ_API_URL = IS_PROD
  ? '/api/chat'
  : 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant'

const STORAGE_KEY      = 'parlare-chat-v1'
const MAX_API_MESSAGES = 50
const WELCOME          = "Hello! I am Sarah, your English teacher. How are you today?"

// Collision-safe id generator (falls back for older browsers without crypto.randomUUID)
const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Fetches 3 short reply suggestions after the main response — non-blocking
async function fetchSuggestions(aiReply, apiKey, isProd, apiUrl) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (!isProd) headers['Authorization'] = `Bearer ${apiKey}`
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'Give exactly 3 very short English reply options (under 6 words each) that a beginner could say in response to the message. Reply ONLY with the 3 options separated by | with no extra text. Example: I like music|I stay home|Tell me more' },
          { role: 'user', content: aiReply },
        ],
        max_tokens: 40,
        temperature: 0.7,
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content ?? ''
    return raw.split('|').map(s => s.trim()).filter(Boolean).slice(0, 3)
  } catch {
    return []
  }
}

const buildWelcome = () => ({ role: 'assistant', content: WELCOME, id: newId() })

// Load persisted chat on init — refresh no longer wipes the conversation.
const loadInitialMessages = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* quota / private mode / corrupt — fall through */ }
  return [buildWelcome()]
}

export function useChat() {
  const [messages, setMessages] = useState(loadInitialMessages)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Refs: messagesRef avoids stale closures, sendingRef guards against rapid double-sends
  // (setLoading is async — two clicks in the same tick can both pass a state-based guard).
  const messagesRef = useRef(messages)
  const sendingRef  = useRef(false)

  useEffect(() => { messagesRef.current = messages }, [messages])

  // Persist messages to localStorage whenever they change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch { /* quota exceeded or private mode — ignore */ }
  }, [messages])

  // Obtiene la API key desde variables de entorno de Vite
  const apiKey = import.meta.env.VITE_GROQ_API_KEY

  const sendMessage = useCallback(async (userText) => {
    if (!userText.trim() || sendingRef.current) return
    sendingRef.current = true

    setError(null)

    // Lee el historial fresco desde el ref (evita stale closure)
    const userMessage = { role: 'user', content: userText.trim(), id: newId() }
    const updatedMessages = [...messagesRef.current, userMessage]
    setMessages(updatedMessages)
    setLoading(true)

    const assistantId = newId()
    let assistantCreated = false

    try {
      // Verifica que existe la API key (solo necesaria en local)
      if (!IS_PROD && (!apiKey || apiKey === 'your_groq_api_key_here')) {
        throw new Error('API_KEY_MISSING')
      }

      // Limita los mensajes enviados a la API a los últimos MAX_API_MESSAGES
      const recentMessages = updatedMessages.slice(-MAX_API_MESSAGES)
      const apiMessages = [
        { role: 'system', content: getSystemPrompt('chat') },
        ...recentMessages.map(({ role, content }) => ({ role, content })),
      ]

      // Llamada a Groq — directa en local, via serverless en producción
      const headers = { 'Content-Type': 'application/json' }
      if (!IS_PROD) headers['Authorization'] = `Bearer ${apiKey}`

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: MODEL,
          messages: apiMessages,
          max_tokens: 250,
          temperature: 0.7,
          stream: true,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData?.error?.message || `HTTP ${response.status}`)
      }

      // Inserta mensaje vacío del asistente y lo rellena token a token
      assistantCreated = true
      setMessages(prev => [...prev, { role: 'assistant', content: '', suggestions: [], id: assistantId }])

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || ''
              if (delta) {
                assistantText += delta
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: assistantText } : m
                ))
              }
            } catch { /* chunk incompleto, ignorar */ }
          }
        }
      }

      if (!assistantText) throw new Error('Empty response from API')

      // Fetch 3 short reply suggestions without blocking the main response
      fetchSuggestions(assistantText, apiKey, IS_PROD, GROQ_API_URL).then(suggestions => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, suggestions } : m
        ))
      })

    } catch (err) {
      // Network errors from fetch surface as TypeError in every modern browser,
      // regardless of OS language — much more reliable than matching message strings.
      let errorMsg = 'Something went wrong. Try again!'

      if (err.message === 'API_KEY_MISSING') {
        errorMsg = '🔑 Check your Groq API key in the .env file. Get it free at console.groq.com'
      } else if (err instanceof TypeError) {
        errorMsg = '🌐 No internet connection. Check your network.'
      } else if (err.message.includes('401') || err.message.includes('invalid_api_key')) {
        errorMsg = '🔑 Invalid API key. Check your .env file. Get a free key at console.groq.com'
      } else if (err.message.includes('429')) {
        errorMsg = '⏳ Too many messages! Wait a moment and try again.'
      }

      setError(errorMsg)
      // Elimina el mensaje del usuario (y el del asistente vacío si se creó) para reintentar
      setMessages(prev => prev.filter(m =>
        m.id !== userMessage.id && (!assistantCreated || m.id !== assistantId)
      ))
    } finally {
      setLoading(false)
      sendingRef.current = false
    }
  }, [apiKey])

  // Limpia el chat y vuelve al mensaje de bienvenida
  const clearChat = useCallback(() => {
    setMessages([buildWelcome()])
    setError(null)
  }, [])

  return { messages, loading, error, sendMessage, clearChat }
}
