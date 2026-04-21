// Voice conversation — SpeechRecognition + Groq + Web Speech TTS
// Mobile-safe: polling for TTS end, fresh recognition per turn, keepalive for Android
import { useState, useRef, useCallback, useEffect } from 'react'
import { getSystemPrompt } from '../config/languages'

export const STATES = {
  IDLE:       'idle',
  LISTENING:  'listening',
  PROCESSING: 'processing',
  SPEAKING:   'speaking',
}

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const IS_PROD      = import.meta.env.PROD
const GROQ_API_URL = IS_PROD
  ? '/api/chat'
  : 'https://api.groq.com/openai/v1/chat/completions'
const MAX_HISTORY  = 50

const SR = window.SpeechRecognition || window.webkitSpeechRecognition

export function useVoiceConversation() {
  const [convState,   setConvState]   = useState(STATES.IDLE)
  const [partialText, setPartialText] = useState('')
  const [userText,    setUserText]    = useState('')
  const [aiText,      setAiText]      = useState('')
  const [error,       setError]       = useState(null)

  const historyRef   = useRef([])
  const activeRef    = useRef(false)
  const listeningRef = useRef(false)

  // TTS timers — need refs to clear from anywhere
  const ttsPollRef   = useRef(null)
  const ttsKeepAlive = useRef(null)
  const ttsSafety    = useRef(null)
  const ttsDoneRef   = useRef(false)

  // ── Groq API ──────────────────────────────────────────────────────────────
  async function callGroq(history) {
    const headers = { 'Content-Type': 'application/json' }
    if (!IS_PROD) headers['Authorization'] = `Bearer ${GROQ_API_KEY}`

    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',
        messages:    [{ role: 'system', content: getSystemPrompt('voice') }, ...history.slice(-MAX_HISTORY)],
        max_tokens:  80,
        temperature: 0.7,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }

  // ── Clear all TTS timers ──────────────────────────────────────────────────
  function clearTtsTimers() {
    clearInterval(ttsPollRef.current)
    clearInterval(ttsKeepAlive.current)
    clearTimeout(ttsSafety.current)
  }

  // ── Start a fresh recognition session ────────────────────────────────────
  // Creates a new instance every time — reusing the same object causes issues on mobile
  function startRecognition() {
    if (!SR || !activeRef.current) return

    const rec = new SR()
    rec.lang            = 'en-US'
    rec.continuous      = false   // one utterance per session; we restart in onend
    rec.interimResults  = true
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('')
      if (e.results[e.results.length - 1].isFinal) {
        if (transcript.trim()) {
          setUserText(transcript)
          setPartialText('')
          processUserTurn(transcript)
        }
      } else {
        setPartialText(transcript)
      }
    }

    rec.onerror = (e) => {
      if (!activeRef.current) return
      if (e.error === 'no-speech' || e.error === 'aborted') return  // normal, onend will restart
      if (e.error === 'not-allowed') {
        setError('Microphone blocked. Please allow microphone access and refresh.')
        activeRef.current = false
        setConvState(STATES.IDLE)
        return
      }
      if (e.error === 'network') {
        setError('Network error. Check your connection.')
        activeRef.current    = false
        listeningRef.current = false
        setConvState(STATES.IDLE)
        return
      }
    }

    rec.onend = () => {
      // Auto-restart only when we should be listening (not while processing or speaking)
      if (listeningRef.current && activeRef.current) {
        setTimeout(() => {
          if (listeningRef.current && activeRef.current) startRecognition()
        }, 150)
      }
    }

    try {
      rec.start()
    } catch {
      // start() can throw if called too fast — retry after a short delay
      if (listeningRef.current && activeRef.current) {
        setTimeout(() => startRecognition(), 400)
      }
    }
  }

  // ── TTS with full mobile compatibility ────────────────────────────────────
  function speakText(text) {
    window.speechSynthesis.cancel()
    clearTtsTimers()
    ttsDoneRef.current = false

    const utter  = new SpeechSynthesisUtterance(text)
    utter.lang   = 'en-US'
    utter.rate   = 0.9
    utter.pitch  = 1
    utter.volume = 1

    const applyVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      const voice  = voices.find(v => v.lang === 'en-US') ||
                     voices.find(v => v.lang.startsWith('en'))
      if (voice) utter.voice = voice
    }
    applyVoice()

    const onDone = () => {
      if (ttsDoneRef.current) return
      ttsDoneRef.current = true
      clearTtsTimers()
      if (!activeRef.current) return
      listeningRef.current = true
      setConvState(STATES.LISTENING)
      // Short delay so mobile browser releases audio before opening mic
      setTimeout(() => {
        if (activeRef.current && listeningRef.current) startRecognition()
      }, 400)
    }

    // 1. Standard events (work on desktop, sometimes on mobile)
    utter.onend   = onDone
    utter.onerror = onDone

    // 2. Polling fallback every 250ms — catches Android Chrome where onend doesn't fire
    ttsPollRef.current = setInterval(() => {
      if (!window.speechSynthesis.speaking) onDone()
    }, 250)

    // 3. Android Chrome 15s bug — synthesis silently pauses after 15s
    //    Fix: pause + resume every 10s to keep it alive
    ttsKeepAlive.current = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 10000)

    // 4. Hard safety timeout (~100ms per char, min 3s, max 12s)
    const safetyMs = Math.min(Math.max(text.length * 100, 3000), 12000)
    ttsSafety.current = setTimeout(onDone, safetyMs)

    listeningRef.current = false
    setConvState(STATES.SPEAKING)

    // On mobile, voices may not be loaded yet when speakText is called
    if (window.speechSynthesis.getVoices().length > 0) {
      window.speechSynthesis.speak(utter)
    } else {
      const onVoicesReady = () => {
        if (!activeRef.current) return   // user stopped session before voices loaded
        applyVoice()
        window.speechSynthesis.speak(utter)
      }
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesReady, { once: true })
    }
  }

  // ── Process one user turn ─────────────────────────────────────────────────
  async function processUserTurn(text) {
    if (!text.trim() || !activeRef.current) return
    listeningRef.current = false
    setConvState(STATES.PROCESSING)
    historyRef.current.push({ role: 'user', content: text })

    try {
      const response = await callGroq(historyRef.current)
      if (!activeRef.current) return
      historyRef.current.push({ role: 'assistant', content: response })
      setAiText(response)
      speakText(response)
    } catch {
      if (!activeRef.current) return
      setError('Could not reach AI. Check your connection.')
      listeningRef.current = true
      setConvState(STATES.LISTENING)
      setTimeout(() => startRecognition(), 300)
    }
  }

  // ── Start session ─────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (!SR) {
      setError('Voice mode requires Chrome or Edge browser.')
      return
    }
    if (!IS_PROD && !GROQ_API_KEY) {
      setError('VITE_GROQ_API_KEY not set in .env file.')
      return
    }

    setError(null)
    setPartialText('')
    setUserText('')
    setAiText('')
    historyRef.current   = []
    activeRef.current    = true
    listeningRef.current = true

    setConvState(STATES.LISTENING)
    startRecognition()
  }, [])

  // ── Stop session ──────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    activeRef.current    = false
    listeningRef.current = false
    clearTtsTimers()
    window.speechSynthesis.cancel()
    historyRef.current = []
    setConvState(STATES.IDLE)
    setPartialText('')
  }, [])

  useEffect(() => () => { stop() }, [stop])

  return { convState, partialText, userText, aiText, error, start, stop, STATES }
}
