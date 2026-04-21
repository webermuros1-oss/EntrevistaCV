// Componente: input de texto + botón micrófono + botón enviar
import { useState, useRef, useEffect } from 'react'

export default function ChatInput({ onSend, loading, disabled, listening, onMicToggle, micSupported }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  // Auto-focus al cargar
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!text.trim() || loading || disabled) return
    onSend(text)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChange = (e) => {
    setText(e.target.value)
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 p-4"
      style={{ borderTop: '1px solid rgba(123, 47, 255, 0.2)', background: 'rgba(15, 15, 26, 0.6)' }}
    >

      {/* Botón micrófono */}
      {micSupported && (
        <button
          type="button"
          onClick={onMicToggle}
          disabled={loading || disabled}
          title={listening ? 'Stop listening' : 'Speak in English'}
          className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all"
          style={listening
            ? { background: 'linear-gradient(135deg, #FF2D9B, #FF4444)', color: 'white', boxShadow: '0 0 16px rgba(255,45,155,0.5)' }
            : { background: 'rgba(123, 47, 255, 0.15)', border: '1px solid rgba(123, 47, 255, 0.3)', color: 'rgba(180,160,220,0.8)' }
          }
          aria-label={listening ? 'Stop microphone' : 'Start microphone'}
        >
          {listening ? (
            <svg className="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          )}
        </button>
      )}

      {/* Campo de texto */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={listening ? '🎤 Listening... speak now!' : 'Write or speak in English...'}
        disabled={loading || disabled || listening}
        rows={1}
        className={`flex-1 resize-none rounded-2xl px-4 py-3 text-sm parlare-input ${listening ? 'parlare-input-listening' : ''}`}
        style={{ minHeight: '48px', maxHeight: '120px' }}
      />

      {/* Botón enviar */}
      <button
        type="submit"
        disabled={!text.trim() || loading || disabled}
        className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all"
        style={!text.trim() || loading || disabled
          ? { background: 'rgba(123,47,255,0.15)', color: 'rgba(180,160,220,0.3)' }
          : { background: 'linear-gradient(135deg,#FF6B00,#7B2FFF)', color: 'white', boxShadow: '0 2px 12px rgba(255,107,0,0.35)' }
        }
        aria-label="Send message"
      >
        {loading ? (
          <svg className="spinner w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        )}
      </button>
    </form>
  )
}
