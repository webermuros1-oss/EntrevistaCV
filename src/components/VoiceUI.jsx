import { useVoiceConversation } from '../hooks/useVoiceConversation'
import LanguagePicker from './LanguagePicker'
import logo from '../public/img/logoParlare.png'

// ─── Orb config per state ─────────────────────────────────────────────────────
const ORB_STYLES = {
  idle: {
    background: 'linear-gradient(135deg, #1C1C30, #2D2D45)',
    ring: 'rgba(100, 100, 160, 0.35)',
    glowClass: '',
    label: 'Ready',
  },
  connecting: {
    background: 'linear-gradient(135deg, #001833, #004466)',
    ring: 'rgba(0, 212, 255, 0.5)',
    glowClass: 'orb-connecting',
    label: 'Connecting…',
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
  const isSpeaking  = state === 'speaking'
  const isListening = state === 'listening'

  return (
    <div className="relative flex items-center justify-center w-36 h-36 mx-auto my-6">
      {/* Outer ring pulse */}
      {(isListening || state === 'connecting') && (
        <span
          className="absolute inset-0 rounded-full opacity-25 animate-ping"
          style={{
            background: cfg.background,
            animationDuration: isListening ? '0.9s' : '1.5s',
          }}
        />
      )}

      {/* Main orb */}
      <div
        className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 ${cfg.glowClass} ${isSpeaking ? 'scale-105' : ''}`}
        style={{
          background: cfg.background,
          boxShadow: `0 0 0 8px ${cfg.ring}`,
        }}
      >
        {isSpeaking ? (
          <SoundWave />
        ) : (
          <span className="text-4xl select-none">
            {state === 'idle'       && '🎙️'}
            {state === 'connecting' && '⟳'}
            {state === 'listening'  && '👂'}
            {state === 'processing' && '💭'}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VoiceUI({ langCode, onLangChange }) {
  const {
    convState,
    partialText,
    userText,
    aiText,
    error,
    start,
    stop,
    STATES,
  } = useVoiceConversation(langCode)

  const isActive = convState !== STATES.IDLE

  return (
    <div className="parlare-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm parlare-card rounded-3xl shadow-2xl overflow-hidden parlare-glow-purple">

        {/* ── Header ── */}
        <div className="parlare-header px-5 py-4 flex items-center gap-3">
          <img src={logo} alt="Parlare" className="w-10 h-10 rounded-xl object-cover" />
          <div>
            <h1 className="parlare-title-gradient text-base">Parlare</h1>
            <p className="text-xs" style={{ color: 'rgba(160,140,210,0.7)' }}>A1-A2 Level</p>
          </div>
        </div>

        {/* ── Language picker (solo cuando IDLE) ── */}
        {!isActive && convState === STATES.IDLE ? (
          <div className="px-4 pt-4 pb-2">
            <LanguagePicker selected={langCode} onChange={onLangChange} />
          </div>
        ) : (
          <>
            {/* ── Orb ── */}
            <VoiceOrb state={convState} />
            {/* ── State label ── */}
            <p className="text-center text-sm font-medium -mt-4 mb-4" style={{ color: 'rgba(180,160,220,0.75)' }}>
              {ORB_STYLES[convState]?.label ?? convState}
            </p>
          </>
        )}

        {/* ── Transcript area ── */}
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

        {/* ── AI response area ── */}
        <div className="mx-4 mb-4 min-h-14 rounded-2xl px-4 py-3 text-sm"
             style={{ background: 'rgba(123,47,255,0.08)', border: '1px solid rgba(123,47,255,0.2)' }}>
          {aiText ? (
            <p className="leading-relaxed" style={{ color: '#e0e0f0' }}>
              <span className="font-semibold" style={{ color: '#9B5FFF' }}>🎓 Teacher: </span>
              {aiText}
            </p>
          ) : (
            <p className="text-center text-xs mt-1" style={{ color: 'rgba(160,140,210,0.35)' }}>
              Teacher's reply will appear here…
            </p>
          )}
        </div>

        {/* ── Error message ── */}
        {error && (
          <div className="mx-4 mb-4 rounded-2xl px-4 py-3 text-xs text-center"
               style={{ background: 'rgba(255,45,155,0.1)', border: '1px solid rgba(255,45,155,0.25)', color: '#FF6B9B' }}>
            {error}
          </div>
        )}

        {/* ── Big action button ── */}
        <div className="px-4 pb-4 flex flex-col items-center gap-3">
          {!isActive ? (
            <button
              onClick={start}
              className="w-full py-4 rounded-2xl text-white text-lg font-bold parlare-btn-primary"
            >
              🎙️ Start
            </button>
          ) : (
            <button
              onClick={stop}
              className="w-full py-4 rounded-2xl text-white text-lg font-bold parlare-btn-stop"
            >
              ⏹ Stop
            </button>
          )}

          <p className="text-xs text-center" style={{ color: 'rgba(160,140,210,0.45)' }}>
            Speak naturally&nbsp;•&nbsp;Pause to send&nbsp;•&nbsp;Interrupt anytime
          </p>
        </div>
      </div>
    </div>
  )
}
