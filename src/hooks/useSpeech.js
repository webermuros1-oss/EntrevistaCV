import { useState, useEffect, useRef, useCallback } from 'react'

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const WHISPER_MODEL    = 'whisper-large-v3-turbo'
const SILENCE_LEVEL    = 12
const SILENCE_MS       = 1400
const MAX_RECORD_MS    = 30000

export function useSpeech({ onResult, onSpeakEnd }) {
  const [listening,        setListening]        = useState(false)
  const [speaking,         setSpeaking]         = useState(false)
  const [transcribing,     setTranscribing]     = useState(false)
  const [micError,         setMicError]         = useState(null)
  const [supported,        setSupported]        = useState({ recognition: false, synthesis: false })

  const recorderRef   = useRef(null)
  const streamRef     = useRef(null)
  const chunksRef     = useRef([])
  const animFrameRef  = useRef(null)
  const maxTimerRef   = useRef(null)
  const pollRef       = useRef(null)
  const keepAliveRef  = useRef(null)
  const safetyRef     = useRef(null)
  const activeRef     = useRef(false)   // true while recording
  const onResultRef   = useRef(onResult)
  const onSpeakEndRef = useRef(onSpeakEnd)
  const apiKey        = import.meta.env.VITE_GROQ_API_KEY

  useEffect(() => { onResultRef.current   = onResult   }, [onResult])
  useEffect(() => { onSpeakEndRef.current = onSpeakEnd }, [onSpeakEnd])

  useEffect(() => {
    // Check support — always true in Chrome/Edge on localhost
    const hasMic = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    const hasTTS = !!window.speechSynthesis
    setSupported({ recognition: hasMic, synthesis: hasTTS })

    if (!hasMic) setMicError('Your browser does not support microphone. Use Chrome or Edge.')

    return () => {
      activeRef.current = false
      cancelAnimationFrame(animFrameRef.current)
      clearTimeout(maxTimerRef.current)
      clearInterval(pollRef.current)
      clearInterval(keepAliveRef.current)
      clearTimeout(safetyRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      window.speechSynthesis?.cancel()
    }
  }, [])

  // ── Stop recording and transcribe ─────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    cancelAnimationFrame(animFrameRef.current)
    clearTimeout(maxTimerRef.current)

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setListening(false)
  }, [])

  // ── Start recording ───────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    setMicError(null)

    // Guard: don't start if already active
    if (activeRef.current) { stopListening(); return }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Microphone API not available. Use Chrome/Edge on localhost.')
      return
    }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicError('Microphone blocked. Click the 🔒 icon in the address bar → allow microphone.')
      } else {
        setMicError(`Microphone error: ${err.message}`)
      }
      return
    }

    streamRef.current  = stream
    chunksRef.current  = []
    activeRef.current  = true

    // AudioContext for silence detection (Safari needs the webkit-prefixed variant)
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const audioCtx = new AudioCtx()
    const source   = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    const dataArr = new Uint8Array(analyser.frequencyBinCount)

    // MediaRecorder — emit chunks every second so audio is preserved if the tab
    // is suspended or the recorder dies mid-session.
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

    recorder.onstop = async () => {
      audioCtx.close()
      if (chunksRef.current.length === 0) { setTranscribing(false); return }

      setTranscribing(true)
      setListening(false)

      try {
        const blob     = new Blob(chunksRef.current, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append('file', blob, 'recording.webm')
        formData.append('model', WHISPER_MODEL)
        formData.append('language', 'en')

        const res  = await fetch(GROQ_WHISPER_URL, {
          method:  'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body:    formData,
        })
        const data = await res.json()
        const text = data?.text?.trim()
        if (text) onResultRef.current(text)
        else setMicError('No speech detected. Try again.')
      } catch (err) {
        if (err instanceof TypeError) setMicError('No internet connection. Check your network.')
        else setMicError('Transcription failed. Try again.')
      } finally {
        setTranscribing(false)
      }
    }

    recorder.start(1000)
    setListening(true)

    // Silence detection (starts after 600ms to let user begin speaking)
    let hasSpoken    = false
    let silenceStart = null

    const detect = () => {
      if (!activeRef.current) return
      analyser.getByteFrequencyData(dataArr)
      const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length

      if (avg > SILENCE_LEVEL) { hasSpoken = true; silenceStart = null }
      else if (hasSpoken) {
        if (!silenceStart) silenceStart = Date.now()
        else if (Date.now() - silenceStart > SILENCE_MS) { stopListening(); return }
      }
      animFrameRef.current = requestAnimationFrame(detect)
    }

    setTimeout(() => { if (activeRef.current) animFrameRef.current = requestAnimationFrame(detect) }, 600)

    // Hard cap
    maxTimerRef.current = setTimeout(() => { if (activeRef.current) stopListening() }, MAX_RECORD_MS)
  }, [stopListening, apiKey])

  const toggleListening = useCallback(() => {
    if (activeRef.current) stopListening()
    else startListening()
  }, [startListening, stopListening])

  // ── Text-to-speech ────────────────────────────────────────────────────────
  // Mobile-safe: polling fallback + Android keep-alive + length-based safety.
  const speak = useCallback((text) => {
    if (!window.speechSynthesis) { onSpeakEndRef.current?.(); return }

    window.speechSynthesis.cancel()
    clearInterval(pollRef.current)
    clearInterval(keepAliveRef.current)
    clearTimeout(safetyRef.current)

    const u  = new SpeechSynthesisUtterance(text)
    u.lang   = 'en-US'
    u.rate   = 0.85
    u.pitch  = 1
    u.volume = 1

    let finished = false
    const done = () => {
      if (finished) return
      finished = true
      clearInterval(pollRef.current)
      clearInterval(keepAliveRef.current)
      clearTimeout(safetyRef.current)
      setSpeaking(false)
      onSpeakEndRef.current?.()
    }

    u.onend   = done
    u.onerror = done

    // Poll every 300ms — catches Android Chrome where onend never fires.
    pollRef.current = setInterval(() => {
      if (!window.speechSynthesis.speaking) done()
    }, 300)

    // Android Chrome 15s bug — synthesis silently pauses. pause+resume keeps it alive.
    keepAliveRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 10000)

    // Hard safety based on text length (~100ms/char, min 3s, max 15s).
    const safetyMs = Math.min(Math.max(text.length * 100, 3000), 15000)
    safetyRef.current = setTimeout(done, safetyMs)

    setSpeaking(true)

    const applyVoice = () => {
      const v = window.speechSynthesis.getVoices()
      const voice = v.find(x => x.lang === 'en-US') || v.find(x => x.lang.startsWith('en'))
      if (voice) u.voice = voice
    }

    if (window.speechSynthesis.getVoices().length > 0) {
      applyVoice()
      window.speechSynthesis.speak(u)
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        applyVoice()
        window.speechSynthesis.speak(u)
      }, { once: true })
    }
  }, [])

  const stopSpeaking = useCallback(() => {
    clearInterval(pollRef.current)
    clearInterval(keepAliveRef.current)
    clearTimeout(safetyRef.current)
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  return {
    listening, speaking, transcribing, micError, supported,
    startListening, stopListening, toggleListening, speak, stopSpeaking,
  }
}
