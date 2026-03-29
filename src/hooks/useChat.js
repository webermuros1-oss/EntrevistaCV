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
// Máximo de mensajes enviados a la API (el historial visible no se toca)
const MAX_API_MESSAGES = 50

const WELCOME = "Hello! I am Sarah, your English teacher. How are you today?"

export function useChat() {
  const welcomeMsg = { role: 'assistant', content: WELCOME, id: Date.now() }
  const [messages, setMessages] = useState([welcomeMsg])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Ref para evitar stale closure: siempre lee el historial más reciente
  const messagesRef = useRef(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])

  // Obtiene la API key desde variables de entorno de Vite
  const apiKey = import.meta.env.VITE_GROQ_API_KEY

  const sendMessage = useCallback(async (userText) => {
    if (!userText.trim() || loading) return

    setError(null)

    // Lee el historial fresco desde el ref (evita stale closure)
    const userMessage = { role: 'user', content: userText.trim(), id: Date.now() }
    const updatedMessages = [...messagesRef.current, userMessage]
    setMessages(updatedMessages)
    setLoading(true)

    let assistantId = null

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
      assistantId = Date.now() + 1
      setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId }])

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

    } catch (err) {
      // Error handling
      let errorMsg = 'Something went wrong. Try again!'

      if (err.message === 'API_KEY_MISSING') {
        errorMsg = '🔑 Check your Groq API key in the .env file. Get it free at console.groq.com'
      } else if (err.message.includes('401') || err.message.includes('invalid_api_key')) {
        errorMsg = '🔑 Invalid API key. Check your .env file. Get a free key at console.groq.com'
      } else if (err.message.includes('429')) {
        errorMsg = '⏳ Too many messages! Wait a moment and try again.'
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorMsg = '🌐 No internet connection. Check your network.'
      }

      setError(errorMsg)
      // Elimina el mensaje del usuario (y el del asistente vacío si se creó) para reintentar
      setMessages(prev => prev.filter(m => m.id !== userMessage.id && m.id !== assistantId))
    } finally {
      setLoading(false)
    }
  }, [loading, apiKey])

  // Limpia el chat y vuelve al mensaje de bienvenida
  const clearChat = useCallback(() => {
    setMessages([{ role: 'assistant', content: WELCOME, id: Date.now() }])
    setError(null)
  }, [])

  return { messages, loading, error, sendMessage, clearChat }
}
