import { useEffect } from 'react'
import { useVoiceConversation, STATES } from '../hooks/useVoiceConversation'
import logo from '../public/img/logoParlare.png'

// ─── Orb config per state ─────────────────────────────────────────────────────
const ORB_STYLES = {
  idle: {
    background: 'linear-gradient(135deg, #1C1C30, #2D2D45)',
    ring: 'rgba(100, 100, 160, 0.35)',
    glowClass: '',
    label: 'Ready',
  },
  listening: {
    background: 'linear-gradient(135deg, #331100, #FF6B00)',
    ring: 'rgba(255, 107, 0, 0.55)',
    glowClass: 'orb-listening',
    label: 'Listening…',
  },
  processing: {
    background: 'linear-gradient(135deg, #2A1500, #FF8C00)',
    ring: 'rgba(255, 140, 0, 0.55)',
    glowClass: 'orb-processing',
    label: 'Thinking…',
  },
  speaking: {
    background: 'linear-gradient(135deg, #180044, #7B2FFF)',
    ring: 'rgba(123, 47, 255, 0.55)',
    glowClass: 'orb-speaking',
    label: 'Speaking…',
  },
}

// ─── Sound-wave bars (shown while speaking) ───────────────────────────────────
function SoundWave() {
  return (
    <div className="flex items-end gap-0.5 h-6">
      {[0, 150, 300, 150, 0].map((delay, i) => (
        <span
          key={i}
          className="w-1 rounded-full animate-bounce"
          style={{
            height: `${[40, 70, 100, 70, 40][i]}%`,
            animationDelay: `${delay}ms`,
            background: 'linear-gradient(180deg, #00D4FF, #7B2FFF)',
          }}
        />
      ))}
    </div>
  )
}

// ─── Animated Orb ────────────────────────────────────────────────────────────
function VoiceOrb({ state }) {
  const cfg = ORB_STYLES[state] || ORB_STYLES.idle
  const isSpeaking  = state === STATES.SPEAKING
  const isListening = state === STATES.LISTENING

  return (
    <div className="relative flex items-center justify-center w-36 h-36 mx-auto my-6">
      {isListening && (
        <span
          className="absolute inset-0 rounded-full opacity-25 animate-ping"
          style={{ background: cfg.background, animationDuration: '0.9s' }}
        />
      )}
      <div
        className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 ${cfg.glowClass} ${isSpeaking ? 'scale-105' : ''}`}
        style={{ background: cfg.background, boxShadow: `0 0 0 8px ${cfg.ring}` }}
      >
        {isSpeaking ? (
          <SoundWave />
        ) : (
          <span className="text-4xl select-none">
            {state === STATES.IDLE       && '🎙️'}
            {state === STATES.LISTENING  && '👂'}
            {state === STATES.PROCESSING && '💭'}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VoiceUI() {
  const { convState, partialText, userText, aiText, error, start, stop } =
    useVoiceConversation()

  const isActive = convState !== STATES.IDLE

  // Space bar toggles the session (Discord-style). Ignored while typing in an input.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.repeat) return
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      e.preventDefault()
      if (isActive) stop(); else start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isActive, start, stop])

  return (
    <div className="parlare-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm parlare-card rounded-3xl shadow-2xl overflow-hidden parlare-glow-purple">

        {/* Header */}
        <div className="parlare-header px-5 py-4 flex items-center gap-3">
          <img src={logo} alt="Parlare" className="w-10 h-10 rounded-xl object-cover" />
          <div>
            <h1 className="parlare-title-gradient text-base">Parlare</h1>
            <p className="text-xs" style={{ color: 'rgba(160,140,210,0.7)' }}>English · A1-A2</p>
          </div>
        </div>

        {/* Orb */}
        <VoiceOrb state={convState} />
        <p
          className="text-center text-sm font-medium -mt-4 mb-4"
          style={{ color: 'rgba(180,160,220,0.75)' }}
          role="status"
          aria-live="polite"
        >
          {ORB_STYLES[convState]?.label ?? convState}
        </p>

        {/* Transcript area — what user said */}
        <div className="mx-4 mb-3 min-h-14 rounded-2xl px-4 py-3 text-sm"
             style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(123,47,255,0.2)' }}>
          {partialText && (
            <p className="italic" style={{ color: 'rgba(160,140,210,0.5)' }}>{partialText}</p>
          )}
          {userText && !partialText && (
            <p style={{ color: '#e0e0f0' }}>
              <span className="font-semibold parlare-text-gradient">You: </span>
              {userText}
            </p>
          )}
          {!partialText && !userText && (
            <p className="text-center text-xs mt-1" style={{ color: 'rgba(160,140,210,0.35)' }}>
              Your words will appear here…
            </p>
          )}
        </div>

        {/* AI response area */}
        <div className="mx-4 mb-4 min-h-14 rounded-2xl px-4 py-3 text-sm"
             style={{ background: 'rgba(123,47,255,0.08)', border: '1px solid rgba(123,47,255,0.2)' }}>
          {aiText ? (
            <p className="leading-relaxed" style={{ color: '#e0e0f0' }}>
              <span className="font-semibold" style={{ color: '#9B5FFF' }}>🎓 Sarah: </span>
              {aiText}
            </p>
          ) : (
            <p className="text-center text-xs mt-1" style={{ color: 'rgba(160,140,210,0.35)' }}>
              Sarah's reply will appear here…
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-4 rounded-2xl px-4 py-3 text-xs text-center"
               style={{ background: 'rgba(255,45,155,0.1)', border: '1px solid rgba(255,45,155,0.25)', color: '#FF6B9B' }}>
            {error}
          </div>
        )}

        {/* Action button */}
        <div className="px-4 pb-4 flex flex-col items-center gap-3">
          {!isActive ? (
            <button onClick={start}
              className="w-full py-4 rounded-2xl text-white text-lg font-bold parlare-btn-primary">
              🎙️ Start conversation
            </button>
          ) : (
            <button onClick={stop}
              className="w-full py-4 rounded-2xl text-white text-lg font-bold parlare-btn-stop">
              ⏹ Stop
            </button>
          )}
          <p className="text-xs text-center" style={{ color: 'rgba(160,140,210,0.45)' }}>
            Speak naturally&nbsp;•&nbsp;Pause to send&nbsp;•&nbsp;Press <kbd className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(123,47,255,0.15)', border: '1px solid rgba(123,47,255,0.3)' }}>Space</kbd> to toggle
          </p>
        </div>
      </div>
    </div>
  )
}
