import { useState, useRef, useCallback, useEffect } from 'react'

// ─── States ──────────────────────────────────────────────────────────────────
const STATES = {
  IDLE:        'idle',
  CONNECTING:  'connecting',
  LISTENING:   'listening',
  PROCESSING:  'processing',
  SPEAKING:    'speaking',
}

// ─── Constants ───────────────────────────────────────────────────────────────
const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY
const GROQ_API_KEY     = import.meta.env.VITE_GROQ_API_KEY
const GROQ_API_URL     = 'https://api.groq.com/openai/v1/chat/completions'
const BARGE_IN_THRESHOLD = 25

const SYSTEM_PROMPT = `You are Sarah, a warm and patient English teacher for absolute beginners (A1 level).

YOUR TEACHING STYLE:
- Speak like a real teacher in a one-on-one spoken lesson — natural, clear, encouraging.
- Use ONLY very simple words. No slang, no idioms, no complex grammar.
- Keep every response SHORT (2-3 sentences max) — this is a voice conversation.
- Never use emojis, symbols, or lists — your words will be spoken aloud.

HOW TO TEACH:
- Start by greeting the student warmly and asking their name and why they want to learn English.
- Each turn, focus on ONE thing: a word, a phrase, or a small grammar point.
- Always give an example sentence using the new word or correction.
- Repeat key words slowly: say them once, use them in a sentence, then invite the student to try.
- When the student makes a mistake, say: "Good try! We say: [correct version]. Can you try again?"
- Celebrate every small win: "Perfect!", "Very good!", "That's right!"
- End each response with ONE simple question to keep the conversation going.

TOPICS FOR BEGINNERS (introduce gradually):
Greetings, numbers 1-20, colors, family members, days of the week, simple present tense (I am, I have, I like), common verbs (eat, drink, go, see, want), asking for things politely.

STRICT RULES:
- Maximum 40 words per response (it is a voice conversation — keep it brief).
- Never use words above A1-A2 level.
- Never give long explanations — teach by doing and repeating.
- Always speak in English. If the student speaks another language, gently reply in English only.`

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useVoiceConversation() {
  const [convState,   setConvState]   = useState(STATES.IDLE)
  const [partialText, setPartialText] = useState('')
  const [userText,    setUserText]    = useState('')
  const [aiText,      setAiText]      = useState('')
  const [error,       setError]       = useState(null)

  // Refs — no server WebSocket anymore, connect directly to Deepgram
  const dgWsRef       = useRef(null)   // Deepgram WebSocket
  const recorderRef   = useRef(null)
  const streamRef     = useRef(null)
  const animFrameRef  = useRef(null)
  const convStateRef  = useRef(STATES.IDLE)
  const analyserRef   = useRef(null)
  const audioCtxRef   = useRef(null)
  const isMutedRef    = useRef(false)           // true while AI speaks → ignore Deepgram
  const pendingRef    = useRef('')              // accumulates final transcript chunks
  const historyRef    = useRef([])             // conversation history for Groq

  // Keep convStateRef in sync
  useEffect(() => { convStateRef.current = convState }, [convState])

  // ─── VAD (barge-in detection) ─────────────────────────────────────────────
  function startVAD(stream) {
    try {
      const ctx      = new (window.AudioContext || window.webkitAudioContext)()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current  = ctx
      analyserRef.current  = analyser

      const dataArr = new Uint8Array(analyser.frequencyBinCount)

      function loop() {
        animFrameRef.current = requestAnimationFrame(loop)
        analyser.getByteFrequencyData(dataArr)
        const avg = dataArr.reduce((s, v) => s + v, 0) / dataArr.length

        // User speaks while AI talking → barge-in
        if (convStateRef.current === STATES.SPEAKING && avg > BARGE_IN_THRESHOLD) {
          window.speechSynthesis.cancel()
          isMutedRef.current = false
          setConvState(STATES.LISTENING)
        }
      }
      loop()
    } catch (e) {
      console.warn('[VAD] Could not start AudioContext:', e)
    }
  }

  function stopVAD() {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    analyserRef.current = null
  }

  // ─── Groq API (direct fetch, same pattern as useChat) ────────────────────
  async function callGroq(history) {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',
        messages:    [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
        max_tokens:  150,
        temperature: 0.7,
      }),
    })
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }

  // ─── speakText (Web Speech API) ───────────────────────────────────────────
  const speakText = useCallback((text) => {
    window.speechSynthesis.cancel()

    const utter   = new SpeechSynthesisUtterance(text)
    utter.lang    = 'en-US'
    utter.rate    = 0.9

    const voices  = window.speechSynthesis.getVoices()
    const enVoice = voices.find(v => v.lang.startsWith('en-US')) ||
                    voices.find(v => v.lang.startsWith('en'))
    if (enVoice) utter.voice = enVoice

    let done = false
    function handleDone() {
      if (done) return
      done = true
      isMutedRef.current = false
      setConvState(STATES.LISTENING)
    }

    const safetyTimer = setTimeout(() => {
      if (convStateRef.current === STATES.SPEAKING) {
        window.speechSynthesis.cancel()
        handleDone()
      }
    }, 15000)

    utter.onend   = () => { clearTimeout(safetyTimer); handleDone() }
    utter.onerror = () => { clearTimeout(safetyTimer); handleDone() }

    isMutedRef.current = true
    setConvState(STATES.SPEAKING)
    window.speechSynthesis.speak(utter)
  }, [])

  // ─── processUserTurn ──────────────────────────────────────────────────────
  async function processUserTurn(text) {
    if (!text.trim()) return

    setConvState(STATES.PROCESSING)
    historyRef.current.push({ role: 'user', content: text })

    let response = ''
    try {
      response = await callGroq(historyRef.current)
    } catch (err) {
      console.error('[Groq] Error:', err.message)
      setError('Could not reach AI. Check your connection.')
      setConvState(STATES.LISTENING)
      isMutedRef.current = false
      return
    }

    historyRef.current.push({ role: 'assistant', content: response })
    setAiText(response)
    speakText(response)
  }

  // ─── stop ─────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    stopVAD()

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    recorderRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    if (dgWsRef.current) {
      try { dgWsRef.current.close() } catch (_) {}
      dgWsRef.current = null
    }

    historyRef.current    = []
    isMutedRef.current    = false
    pendingRef.current    = ''
    setConvState(STATES.IDLE)
    setPartialText('')
  }, [])

  // ─── start ────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    setError(null)
    setConvState(STATES.CONNECTING)
    setPartialText('')
    setUserText('')
    setAiText('')
    historyRef.current = []
    isMutedRef.current = false
    pendingRef.current = ''

    // 1. Check API keys
    if (!DEEPGRAM_API_KEY) {
      setError('VITE_DEEPGRAM_API_KEY not configured.')
      setConvState(STATES.IDLE)
      return
    }
    if (!GROQ_API_KEY) {
      setError('VITE_GROQ_API_KEY not configured.')
      setConvState(STATES.IDLE)
      return
    }

    // 2. Get microphone
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      })
    } catch (e) {
      setError('Microphone access denied. Please allow microphone and try again.')
      setConvState(STATES.IDLE)
      return
    }
    streamRef.current = stream

    // 3. Connect directly to Deepgram WebSocket (same params the server was using)
    // Auth via subprotocol — única forma que funciona en browser (no soporta headers custom)
    const dgUrl =
      'wss://api.deepgram.com/v1/listen' +
      '?model=nova-2' +
      '&language=en-US' +
      '&smart_format=true' +
      '&interim_results=true' +
      '&endpointing=500' +
      '&utterance_end_ms=1500' +
      '&vad_events=true'

    let dgWs
    try {
      dgWs = new WebSocket(dgUrl, ['token', DEEPGRAM_API_KEY])
    } catch (e) {
      setError('Cannot connect to speech service. Check your API key.')
      stream.getTracks().forEach(t => t.stop())
      setConvState(STATES.IDLE)
      return
    }
    dgWsRef.current  = dgWs
    dgWs.binaryType  = 'arraybuffer'

    dgWs.onerror = () => {
      setError('Speech service error. Please check your Deepgram API key.')
      setConvState(STATES.IDLE)
    }

    dgWs.onclose = () => {
      if (convStateRef.current !== STATES.IDLE) setConvState(STATES.IDLE)
    }

    // 4. Handle Deepgram messages (same logic the server had)
    dgWs.onmessage = (event) => {
      let msg
      try { msg = JSON.parse(event.data) } catch { return }

      // UtteranceEnd fallback
      if (msg.type === 'UtteranceEnd') {
        if (isMutedRef.current) return
        if (pendingRef.current.trim()) {
          const toProcess   = pendingRef.current
          pendingRef.current = ''
          processUserTurn(toProcess)
        }
        return
      }

      // Transcript event
      const alt        = msg?.channel?.alternatives?.[0]
      if (!alt) return

      const text       = alt.transcript ?? ''
      const isFinal    = msg.is_final   ?? false
      const speechFinal = msg.speech_final ?? false

      if (isMutedRef.current) return

      if (!isFinal) {
        if (text) setPartialText(text)
        return
      }

      // Final transcript chunk
      if (text.trim()) {
        pendingRef.current = (pendingRef.current + ' ' + text).trim()
        setUserText(pendingRef.current)
        setPartialText('')
      }

      if (speechFinal && pendingRef.current.trim()) {
        const toProcess   = pendingRef.current
        pendingRef.current = ''
        processUserTurn(toProcess)
      }
    }

    // 5. On open → start MediaRecorder + VAD
    dgWs.onopen = () => {
      setConvState(STATES.LISTENING)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      let recorder
      try {
        recorder = new MediaRecorder(stream, { mimeType })
      } catch (e) {
        setError('MediaRecorder not supported in this browser.')
        dgWs.close()
        stream.getTracks().forEach(t => t.stop())
        setConvState(STATES.IDLE)
        return
      }
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0 && dgWs.readyState === WebSocket.OPEN && !isMutedRef.current) {
          dgWs.send(e.data)
        }
      }

      recorder.start(100)  // chunk every 100ms
      startVAD(stream)
    }
  }, [speakText])

  // Cleanup on unmount
  useEffect(() => { return () => { stop() } }, [stop])

  return { convState, partialText, userText, aiText, error, start, stop, STATES }
}
