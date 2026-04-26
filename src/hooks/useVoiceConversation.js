import { useState, useRef, useCallback, useEffect } from 'react'
import { buildInterviewPrompt } from '../config/interviewer'

export const STATES = {
  IDLE:       'idle',
  LISTENING:  'listening',
  PROCESSING: 'processing',
  SPEAKING:   'speaking',
}

const IS_PROD      = import.meta.env.PROD
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const GROQ_API_URL = IS_PROD
  ? '/api/chat'
  : 'https://api.groq.com/openai/v1/chat/completions'
const MAX_HISTORY  = 40

const SR = window.SpeechRecognition || window.webkitSpeechRecognition

const IS_IOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const KICKOFF = 'Hola, soy el candidato y estoy listo para empezar la entrevista.'

export function useVoiceConversation(config) {
  const [convState,   setConvState]   = useState(STATES.IDLE)
  const [partialText, setPartialText] = useState('')
  const [userText,    setUserText]    = useState('')
  const [aiText,      setAiText]      = useState('')
  const [error,       setError]       = useState(null)

  // Core state refs — avoid stale closures across async chains
  const activeRef     = useRef(false)  // true while session is running
  const listeningRef  = useRef(false)  // true when we WANT the mic open
  const historyRef    = useRef([])

  // Single recognition instance — prevents multiple overlapping SR objects
  const recRef        = useRef(null)
  const startingRef   = useRef(false)  // guard against concurrent start() calls

  // Groq fetch abort controller
  const abortRef      = useRef(null)

  // Debounce: hold the latest final transcript and send after 1.2s of real silence.
  // If the user keeps talking the timer resets, so they get time to think mid-answer.
  const pendingTranscriptRef = useRef(null)
  const sendTimerRef         = useRef(null)

  // TTS timers
  const ttsPollRef    = useRef(null)
  const ttsKeepAlive  = useRef(null)
  const ttsSafety     = useRef(null)
  const ttsDoneRef    = useRef(false)

  // Tracked timeouts (restart / silence-wait) — cleared on stop()
  const pendingTimers = useRef(new Set())

  const trackedTimeout = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      pendingTimers.current.delete(id)
      fn()
    }, ms)
    pendingTimers.current.add(id)
    return id
  }, [])

  const clearPendingTimers = useCallback(() => {
    for (const id of pendingTimers.current) clearTimeout(id)
    pendingTimers.current.clear()
  }, [])

  // ── TTS timers ────────────────────────────────────────────────────────────
  const clearTtsTimers = useCallback(() => {
    clearInterval(ttsPollRef.current)
    clearInterval(ttsKeepAlive.current)
    clearTimeout(ttsSafety.current)
  }, [])

  // ── Abort + nullify the current SR instance ───────────────────────────────
  // Zero out callbacks first so onend can't trigger restarts after we abort.
  const abortRecognition = useCallback(() => {
    startingRef.current = false
    if (!recRef.current) return
    try {
      recRef.current.onstart  = null
      recRef.current.onresult = null
      recRef.current.onerror  = null
      recRef.current.onend    = null
    } catch { /* ignore */ }
    try { recRef.current.abort() } catch { /* ignore */ }
    recRef.current = null
  }, [])

  // ── Groq API call ─────────────────────────────────────────────────────────
  const callGroq = useCallback(async (history) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    const headers = { 'Content-Type': 'application/json' }
    if (!IS_PROD) headers['Authorization'] = `Bearer ${GROQ_API_KEY}`

    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',
        messages:    [
          { role: 'system', content: buildInterviewPrompt(config) },
          ...history.slice(-MAX_HISTORY),
        ],
        max_tokens:  250,
        temperature: 0.8,
      }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() ?? ''
  }, [config])

  // ── Accumulate + debounce send ────────────────────────────────────────────
  // Each isFinal segment is APPENDED to whatever the user already said.
  // The 2.8 s timer resets on every new segment, so a brief natural pause
  // (which makes the browser restart SR) never cuts the answer short.
  // The accumulation clears automatically once we hand off to processUserTurn.
  const scheduleSend = useCallback((newSegment) => {
    clearTimeout(sendTimerRef.current)
    const accumulated = pendingTranscriptRef.current
      ? pendingTranscriptRef.current.trimEnd() + ' ' + newSegment.trim()
      : newSegment.trim()
    pendingTranscriptRef.current = accumulated
    setUserText(accumulated)   // show the full running text while composing
    sendTimerRef.current = setTimeout(() => {
      const final = pendingTranscriptRef.current
      pendingTranscriptRef.current = null
      if (!final || !activeRef.current) return
      listeningRef.current = false
      abortRecognition()
      setPartialText('')
      processUserTurn(final)
    }, 2800)
  }, [])  // processUserTurn captured via closure — stable ref pattern below

  // ── Start a fresh recognition session ────────────────────────────────────
  // Only one SR instance lives at a time. Guards prevent concurrent creation.
  const startRecognition = useCallback(() => {
    if (!SR)                                            return
    if (!activeRef.current || !listeningRef.current)   return
    if (startingRef.current || recRef.current)         return  // already starting/active

    startingRef.current = true

    const rec = new SR()
    rec.lang            = 'es-ES'
    rec.continuous      = false    // one utterance per instance; onend restarts
    rec.interimResults  = true
    rec.maxAlternatives = 1

    rec.onstart = () => {
      startingRef.current = false
    }

    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('')
      const isFinal    = e.results[e.results.length - 1].isFinal
      if (isFinal) {
        if (transcript.trim()) {
          setPartialText('')
          scheduleSend(transcript)  // acumula y muestra el texto completo; resetea el timer
        }
      } else {
        setPartialText(transcript)
      }
    }

    rec.onerror = (e) => {
      startingRef.current = false
      if (!activeRef.current) return
      // 'no-speech' and 'aborted' are normal — onend will auto-restart
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Micrófono bloqueado. Permite el acceso en la barra del navegador e inténtalo de nuevo.')
        activeRef.current   = false
        listeningRef.current = false
        setConvState(STATES.IDLE)
        return
      }
      if (e.error === 'network') {
        setError('Error de red en el reconocimiento de voz. Revisa tu conexión.')
        activeRef.current   = false
        listeningRef.current = false
        setConvState(STATES.IDLE)
      }
    }

    rec.onend = () => {
      startingRef.current = false
      if (recRef.current === rec) recRef.current = null

      // Restart whenever we're still in listening mode — this includes the 1.2 s
      // grace period where the user may want to add more to their answer.
      if (activeRef.current && listeningRef.current) {
        trackedTimeout(() => {
          if (activeRef.current && listeningRef.current) startRecognition()
        }, 200)
      }
    }

    recRef.current = rec

    try {
      rec.start()
    } catch {
      // start() can throw if engine isn't ready (rare on Android). Retry once.
      startingRef.current = false
      if (recRef.current === rec) recRef.current = null
      if (activeRef.current && listeningRef.current) {
        trackedTimeout(() => startRecognition(), 450)
      }
    }
  }, [trackedTimeout])

  // ── TTS — sentence-split to beat the Android 15 s cutoff bug ───────────────
  // Android Chrome silently kills utterances longer than ~15 s.
  // Fix: split the text into individual sentences and queue them separately.
  // Each sentence is short enough to finish before the OS cuts it off.
  // waitForSilence has a hard 2 s fallback so it never hangs if Android leaves
  // speechSynthesis.speaking stuck on true after cutting off.
  const speakText = useCallback((text) => {
    window.speechSynthesis.cancel()
    clearTtsTimers()
    ttsDoneRef.current = false

    // Reset accumulation buffer — next user turn starts fresh
    clearTimeout(sendTimerRef.current)
    pendingTranscriptRef.current = null

    const getVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      return voices.find(v => v.lang === 'es-ES') ||
             voices.find(v => v.lang.startsWith('es')) ||
             null
    }

    // Split on sentence-ending punctuation, keeping the punctuation attached
    const sentences = text.match(/[^.!?¿¡]+[.!?]*/g)
      ?.map(s => s.trim()).filter(Boolean) ?? [text]

    const onDone = () => {
      if (ttsDoneRef.current) return
      ttsDoneRef.current = true
      clearTtsTimers()
      if (!activeRef.current) return

      // Wait for synthesis to go truly idle before opening the mic.
      // Hard cap of 20 iterations (2 s) in case Android leaves speaking=true.
      let attempts = 0
      const waitForSilence = () => {
        if (!activeRef.current) return
        const ss = window.speechSynthesis
        attempts++
        if (attempts > 20 || !ss || (!ss.speaking && !ss.pending)) {
          if (attempts > 20) try { window.speechSynthesis.cancel() } catch { /* ignore */ }
          listeningRef.current = true
          setConvState(STATES.LISTENING)
          startRecognition()
          return
        }
        trackedTimeout(waitForSilence, 100)
      }
      trackedTimeout(waitForSilence, 350)
    }

    // Build one utterance per sentence
    const utters = sentences.map((sentence, i) => {
      const u = new SpeechSynthesisUtterance(sentence)
      u.lang   = 'es-ES'
      u.rate   = 1.0
      u.pitch  = 1
      u.volume = 1
      const v = getVoice()
      if (v) u.voice = v
      // Only the last sentence triggers onDone; any error in any sentence ends early
      if (i === sentences.length - 1) u.onend = onDone
      u.onerror = onDone
      return u
    })

    // Fallback poll — catches Android where onend of the last utterance never fires
    ttsPollRef.current = setInterval(() => {
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) onDone()
    }, 300)

    // Overall safety timeout based on full text length (no hard cap)
    const safetyMs = Math.max(text.length * 95, 5000)
    ttsSafety.current = setTimeout(onDone, safetyMs)

    listeningRef.current = false
    setConvState(STATES.SPEAKING)

    const enqueue = () => {
      for (const u of utters) window.speechSynthesis.speak(u)
    }

    if (window.speechSynthesis.getVoices().length > 0) {
      enqueue()
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        if (!activeRef.current) return
        // Re-apply voice now that voices are loaded
        const v = getVoice()
        if (v) utters.forEach(u => { u.voice = v })
        enqueue()
      }, { once: true })
    }
  }, [clearTtsTimers, trackedTimeout, startRecognition])

  // ── Process one user turn ─────────────────────────────────────────────────
  const processUserTurn = useCallback(async (text) => {
    if (!text.trim() || !activeRef.current) return
    listeningRef.current = false
    abortRecognition()   // close mic before hitting the API
    setConvState(STATES.PROCESSING)
    historyRef.current.push({ role: 'user', content: text })

    try {
      const reply = await callGroq(historyRef.current)
      if (!activeRef.current) return
      historyRef.current.push({ role: 'assistant', content: reply })
      setAiText(reply)
      speakText(reply)
    } catch (err) {
      if (err.name === 'AbortError') return
      if (!activeRef.current) return
      setError('No se pudo conectar con la IA. Revisa tu conexión e inténtalo de nuevo.')
      // Re-open mic so the user can retry without restarting
      listeningRef.current = true
      setConvState(STATES.LISTENING)
      trackedTimeout(() => startRecognition(), 300)
    }
  }, [abortRecognition, callGroq, speakText, trackedTimeout, startRecognition])

  // ── Kickoff: AI opens the interview ───────────────────────────────────────
  const kickoffInterview = useCallback(async () => {
    if (!activeRef.current) return
    setConvState(STATES.PROCESSING)
    historyRef.current = [{ role: 'user', content: KICKOFF }]

    try {
      const opening = await callGroq(historyRef.current)
      if (!activeRef.current) return
      historyRef.current.push({ role: 'assistant', content: opening })
      setAiText(opening)
      speakText(opening)
    } catch (err) {
      if (err.name === 'AbortError') return
      if (!activeRef.current) return
      setError('No se pudo iniciar la entrevista. Revisa tu conexión.')
      activeRef.current = false
      setConvState(STATES.IDLE)
    }
  }, [callGroq, speakText])

  // ── Start session ─────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (activeRef.current) return  // idempotent

    if (IS_IOS) {
      setError('iOS Safari no permite reconocimiento de voz. Usa Chrome en Android o un ordenador.')
      return
    }
    if (!SR) {
      setError('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.')
      return
    }
    if (!IS_PROD && !GROQ_API_KEY) {
      setError('Falta VITE_GROQ_API_KEY en el archivo .env')
      return
    }

    setError(null)
    setPartialText('')
    setUserText('')
    setAiText('')
    historyRef.current   = []
    activeRef.current    = true
    listeningRef.current = false

    // Unlock TTS while we still have the user-gesture context.
    // Without this, some browsers (especially Android Chrome) silently refuse
    // the first speechSynthesis.speak() call that happens inside an async chain.
    try {
      const primer = new SpeechSynthesisUtterance(' ')
      primer.volume = 0
      window.speechSynthesis.speak(primer)
    } catch { /* ignore */ }

    kickoffInterview()
  }, [kickoffInterview])

  // ── Stop session ──────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    activeRef.current   = false
    listeningRef.current = false
    abortRef.current?.abort()
    clearTimeout(sendTimerRef.current)
    pendingTranscriptRef.current = null
    clearTtsTimers()
    clearPendingTimers()
    abortRecognition()
    try { window.speechSynthesis.cancel() } catch { /* ignore */ }
    historyRef.current = []
    setConvState(STATES.IDLE)
    setPartialText('')
  }, [clearTtsTimers, clearPendingTimers, abortRecognition])

  useEffect(() => () => { stop() }, [stop])

  return { convState, partialText, userText, aiText, error, start, stop }
}
