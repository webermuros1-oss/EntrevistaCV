import { useRef, useEffect, useCallback, useState } from 'react'
import { useChat } from './hooks/useChat'
import { useBasicEnglish } from './hooks/useBasicEnglish'
import { useSpeech } from './hooks/useSpeech'
import ChatMessage from './components/ChatMessage'
import ChatInput from './components/ChatInput'
import VoiceUI from './components/VoiceUI'
import LanguagePicker from './components/LanguagePicker'
import logo from './public/img/logoParlare.png'
import { DEFAULT_LANG, LANGUAGES } from './config/languages'

const EXAMPLE_PROMPTS = [
  'Hello! What is your name?',
  'I want to learn English.',
  'What is the weather today?',
  'Can you help me practice?',
]

export default function App() {
  const [mode, setMode] = useState('voice')       // 'chat' | 'voice'
  const [langCode, setLangCode] = useState(DEFAULT_LANG)

  const { messages, loading, error, sendMessage, clearChat } = useChat(langCode)
  const { simplifyText, validateInput }                       = useBasicEnglish()
  const [convoMode, setConvoMode] = useState(false)
  const messagesEndRef = useRef(null)
  const prevMsgLen     = useRef(1)
  const convoModeRef   = useRef(false)

  useEffect(() => { convoModeRef.current = convoMode }, [convoMode])

  const handleSend = useCallback((text) => {
    const { valid, error: msg } = validateInput(text)
    if (!valid) { alert(msg); return }
    sendMessage(simplifyText(text))
  }, [validateInput, simplifyText, sendMessage])

  const startListeningRef = useRef(null)
  const handleSpeakEndSafe = useCallback(() => {
    if (!convoModeRef.current) return
    setTimeout(() => {
      if (convoModeRef.current) startListeningRef.current?.()
    }, 400)
  }, [])

  const { listening, speaking, transcribing, micError, supported,
          startListening, stopListening, toggleListening, speak, stopSpeaking } =
    useSpeech({
      onResult:   useCallback((t) => { if (t) handleSend(t) }, [handleSend]),
      onSpeakEnd: handleSpeakEndSafe,
    })

  useEffect(() => { startListeningRef.current = startListening }, [startListening])

  // Speak every new assistant message
  useEffect(() => {
    if (!supported.synthesis) return
    if (messages.length <= prevMsgLen.current) { prevMsgLen.current = messages.length; return }
    prevMsgLen.current = messages.length
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant') speak(last.content)
  }, [messages, supported.synthesis, speak])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const toggleConvoMode = () => {
    if (convoMode) {
      setConvoMode(false)
      stopSpeaking()
      stopListening()
    } else {
      setConvoMode(true)
      startListening()
    }
  }

  const handleClear = () => {
    setConvoMode(false)
    stopSpeaking()
    stopListening()
    clearChat()
  }

  const isActive = listening || speaking || transcribing || (convoMode && loading)

  return (
    <>
    {/* ── Mode toggle bar ── */}
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 parlare-topbar">
      {/* Logo */}
      <img src={logo} alt="Parlare" className="h-8 w-8 rounded-lg object-cover" />

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('chat')}
          className="px-5 py-1.5 rounded-full text-sm font-semibold transition-all"
          style={mode === 'chat'
            ? { background: 'linear-gradient(135deg,#FF6B00,#7B2FFF)', color: 'white', boxShadow: '0 2px 12px rgba(255,107,0,0.35)' }
            : { color: 'rgba(180,160,220,0.8)', border: '1px solid rgba(123,47,255,0.3)' }}
        >
          💬 Chat
        </button>
        <button
          onClick={() => setMode('voice')}
          className="px-5 py-1.5 rounded-full text-sm font-semibold transition-all"
          style={mode === 'voice'
            ? { background: 'linear-gradient(135deg,#FF6B00,#7B2FFF)', color: 'white', boxShadow: '0 2px 12px rgba(255,107,0,0.35)' }
            : { color: 'rgba(180,160,220,0.8)', border: '1px solid rgba(123,47,255,0.3)' }}
        >
          🎙️ Voice
        </button>
      </div>

      {/* Idioma activo — indicador */}
      <div className="text-lg w-8 text-center">
        {LANGUAGES[langCode]?.flag}
      </div>
    </div>

    {mode === 'voice' && (
      <div className="pt-12 parlare-bg min-h-screen flex flex-col items-center px-4">
        {/* Picker encima de la card de voz */}
        <div className="w-full max-w-sm mt-4 mb-3 parlare-card rounded-3xl p-4 parlare-glow-purple">
          <LanguagePicker
            selected={langCode}
            onChange={setLangCode}
          />
        </div>
        <VoiceUI langCode={langCode} />
      </div>
    )}

    {mode === 'chat' && (
    <div className="pt-12 parlare-bg flex flex-col items-center p-4">
      {/* Picker encima de la card de chat — solo antes de empezar */}
      {messages.length <= 1 && !loading && (
        <div className="w-full max-w-md mb-3 parlare-card rounded-3xl p-4 parlare-glow-purple">
          <LanguagePicker
            selected={langCode}
            onChange={(code) => { setLangCode(code); clearChat() }}
          />
        </div>
      )}
      <div className="w-full max-w-md parlare-card rounded-3xl shadow-2xl overflow-hidden flex flex-col parlare-glow-purple"
           style={{ height: '90vh', maxHeight: '700px' }}>

        {/* Header */}
        <div className="parlare-header px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Parlare" className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <h1 className="parlare-title-gradient text-base">Parlare</h1>
              <p className="text-xs" style={{ color: 'rgba(160,140,210,0.7)' }}>Basic Level · A1-A2</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {supported.recognition && (
              <button onClick={toggleConvoMode}
                className="text-xs px-3 py-1 rounded-full font-medium transition-all"
                style={convoMode
                  ? { background: 'linear-gradient(135deg,#FF2D9B,#FF6B00)', color: 'white' }
                  : { color: 'rgba(180,160,220,0.8)', border: '1px solid rgba(123,47,255,0.3)' }}>
                {convoMode ? '🛑 Stop' : '🎙️ Convo'}
              </button>
            )}
            <button onClick={handleClear}
              className="text-xs px-3 py-1 rounded-full transition-colors"
              style={{ color: 'rgba(180,160,220,0.7)', border: '1px solid rgba(123,47,255,0.3)' }}>
              Clear
            </button>
          </div>
        </div>

        {/* Mic error warning */}
        {micError && (
          <div className="px-4 py-2 text-xs text-center"
               style={{ background: 'rgba(255,107,0,0.1)', borderBottom: '1px solid rgba(255,107,0,0.2)', color: '#FF8C42' }}>
            🎤 {micError}
          </div>
        )}

        {/* Status banner */}
        {isActive && !micError && (
          <div className="px-4 py-2 flex items-center justify-between text-xs font-medium"
               style={{
                 background: listening   ? 'rgba(255,107,0,0.1)'
                           : speaking   ? 'rgba(123,47,255,0.1)'
                                        : 'rgba(255,140,0,0.1)',
                 borderBottom: listening ? '1px solid rgba(255,107,0,0.2)'
                             : speaking ? '1px solid rgba(123,47,255,0.2)'
                                        : '1px solid rgba(255,140,0,0.2)',
                 color: listening   ? '#FF8C42'
                      : speaking   ? '#9B5FFF'
                                   : '#FFAA00',
               }}>
            <div className="flex items-center gap-2">
              {listening    && <><span className="w-2 h-2 rounded-full animate-ping" style={{ background: '#FF6B00' }} />Listening… (speak, then pause)</>}
              {transcribing && <><span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FF2D9B' }} />Transcribing…</>}
              {speaking     && <><span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7B2FFF' }} />Teacher speaking…</>}
              {!listening && !transcribing && !speaking && <><span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FFAA00' }} />Thinking…</>}
            </div>
            {speaking && (
              <button onClick={stopSpeaking} className="underline opacity-70 hover:opacity-100">Skip →</button>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 chat-scroll"
             style={{ background: 'rgba(0,0,0,0.15)' }}>
          {messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}

          {loading && (
            <div className="flex justify-start mb-3 message-appear">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0"
                   style={{ background: 'linear-gradient(135deg,#7B2FFF,#FF2D9B)' }}>🎓</div>
              <div className="rounded-2xl rounded-bl-sm px-4 py-3 parlare-card">
                <div className="flex gap-1">
                  {[0,150,300].map(d => (
                    <span key={d} className="w-2 h-2 rounded-full animate-bounce"
                          style={{ background: 'linear-gradient(135deg,#FF6B00,#7B2FFF)', animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-xs text-xs rounded-xl px-4 py-3 mb-3 text-center message-appear"
                 style={{ background: 'rgba(255,45,155,0.1)', border: '1px solid rgba(255,45,155,0.25)', color: '#FF6B9B' }}>
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Example prompts */}
        {messages.length <= 1 && !loading && (
          <div className="px-4 pb-3 pt-3" style={{ borderTop: '1px solid rgba(123,47,255,0.15)' }}>
            <p className="text-xs text-center mb-2" style={{ color: 'rgba(160,140,210,0.5)' }}>Try saying:</p>
            <div className="flex flex-wrap gap-1 justify-center">
              {EXAMPLE_PROMPTS.map(p => (
                <button key={p} onClick={() => handleSend(p)}
                  className="text-xs rounded-full px-3 py-1 transition-all"
                  style={{ background: 'rgba(123,47,255,0.12)', border: '1px solid rgba(123,47,255,0.3)', color: '#9B5FFF' }}
                  onMouseEnter={e => e.target.style.background = 'rgba(123,47,255,0.22)'}
                  onMouseLeave={e => e.target.style.background = 'rgba(123,47,255,0.12)'}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          loading={loading}
          listening={listening}
          onMicToggle={toggleListening}
          micSupported={supported.recognition}
        />
      </div>

      <p className="text-xs mt-3" style={{ color: 'rgba(160,140,210,0.4)' }}>Powered by Groq API · Llama 3.1 8B · Free</p>
    </div>
    )}
    </>
  )
}
