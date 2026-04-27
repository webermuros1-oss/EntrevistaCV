import { useEffect } from 'react'
import { useVoiceConversation, STATES } from '../hooks/useVoiceConversation'
import { SECTORS, LEVELS } from '../config/interviewer'
import logo from '../public/img/logoCV.png'

const SECTOR_LABEL = Object.fromEntries(SECTORS.map(s => [s.id, s.label]))
const LEVEL_LABEL  = Object.fromEntries(LEVELS.map(l => [l.id, l.label]))

const ORB_STYLES = {
  idle: {
    background: 'linear-gradient(135deg, #DBEAFE, #EFF6FF)',
    ring:       'rgba(26, 115, 232, 0.2)',
    glowClass:  '',
    label:      'Pulsa para empezar',
    icon:       '🎙️',
  },
  listening: {
    background: 'linear-gradient(135deg, #FF6D00, #FF8C42)',
    ring:       'rgba(255, 109, 0, 0.4)',
    glowClass:  'orb-listening',
    label:      'Escuchando…',
    icon:       '👂',
  },
  processing: {
    background: 'linear-gradient(135deg, #4FC3F7, #1A73E8)',
    ring:       'rgba(79, 195, 247, 0.45)',
    glowClass:  'orb-processing',
    label:      'Pensando…',
    icon:       '💭',
  },
  speaking: {
    background: 'linear-gradient(135deg, #1A73E8, #0D47A1)',
    ring:       'rgba(26, 115, 232, 0.45)',
    glowClass:  'orb-speaking',
    label:      'Hablando…',
    icon:       null,
  },
}

function SoundWave() {
  return (
    <div className="flex items-end gap-0.5 h-6">
      {[0, 150, 300, 150, 0].map((delay, i) => (
        <span
          key={i}
          className="w-1 rounded-full animate-bounce"
          style={{
            height:         `${[40, 70, 100, 70, 40][i]}%`,
            animationDelay: `${delay}ms`,
            background:     'linear-gradient(180deg, #FFFFFF, rgba(255,255,255,0.7))',
          }}
        />
      ))}
    </div>
  )
}

function VoiceOrb({ state }) {
  const cfg        = ORB_STYLES[state] || ORB_STYLES.idle
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
        className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center
                    transition-all duration-500 ${cfg.glowClass} ${isSpeaking ? 'scale-105' : ''}`}
        style={{ background: cfg.background, boxShadow: `0 0 0 8px ${cfg.ring}` }}
      >
        {isSpeaking ? <SoundWave /> : <span className="text-4xl select-none">{cfg.icon}</span>}
      </div>
    </div>
  )
}

export default function VoiceUI({ config, onChangeSetup }) {
  const { convState, partialText, userText, aiText, error, start, stop } =
    useVoiceConversation(config)

  const isActive = convState !== STATES.IDLE

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

  const handleChangeSetup = () => {
    if (isActive) stop()
    onChangeSetup()
  }

  return (
    <div className="cv-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm cv-card rounded-3xl shadow-2xl overflow-hidden cv-glow-blue">

        {/* Header */}
        <div className="cv-header px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logo} alt="EntrevistaCV" className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 flex-shrink-0" style={{ boxShadow: '0 1px 4px rgba(26,115,232,0.15)' }} />
            <div className="min-w-0">
              <h1 className="cv-title-gradient text-sm font-bold truncate">{config.role}</h1>
              <p className="text-xs truncate" style={{ color: '#64748B' }}>
                {SECTOR_LABEL[config.sector]} · {LEVEL_LABEL[config.level]}
              </p>
            </div>
          </div>
          <button
            onClick={handleChangeSetup}
            title="Cambiar entrevista"
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-blue-50"
            style={{ color: '#64748B', border: '1px solid rgba(26,115,232,0.22)' }}
          >
            ⚙️
          </button>
        </div>

        {/* Orb */}
        <VoiceOrb state={convState} />
        <p
          className="text-center text-sm font-medium -mt-4 mb-4"
          style={{ color: '#64748B' }}
          role="status"
          aria-live="polite"
        >
          {ORB_STYLES[convState]?.label ?? convState}
        </p>

        {/* Lo que dijo el usuario */}
        <div
          className="mx-4 mb-3 min-h-14 rounded-2xl px-4 py-3 text-sm"
          style={{ background: '#F8FAFF', border: '1px solid rgba(26,115,232,0.18)' }}
        >
          {partialText && (
            <p className="italic" style={{ color: '#94A3B8' }}>{partialText}</p>
          )}
          {userText && !partialText && (
            <p style={{ color: '#1E293B' }}>
              <span className="font-semibold cv-text-gradient">Tú: </span>
              {userText}
            </p>
          )}
          {!partialText && !userText && (
            <p className="text-center text-xs mt-1" style={{ color: '#94A3B8' }}>
              Tu respuesta aparecerá aquí…
            </p>
          )}
        </div>

        {/* Respuesta de la IA */}
        <div
          className="mx-4 mb-4 min-h-14 rounded-2xl px-4 py-3 text-sm"
          style={{ background: '#EFF6FF', border: '1px solid rgba(26,115,232,0.18)' }}
        >
          {aiText ? (
            <p className="leading-relaxed" style={{ color: '#1E293B' }}>
              <span className="font-semibold" style={{ color: '#1A73E8' }}>🎤 Entrevistadora: </span>
              {aiText}
            </p>
          ) : (
            <p className="text-center text-xs mt-1" style={{ color: '#94A3B8' }}>
              La entrevistadora hablará aquí…
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            className="mx-4 mb-4 rounded-2xl px-4 py-3 text-xs text-center"
            style={{ background: 'rgba(229,57,53,0.08)', border: '1px solid rgba(229,57,53,0.25)', color: '#C62828' }}
          >
            {error}
          </div>
        )}

        {/* Botón principal */}
        <div className="px-4 pb-4 flex flex-col items-center gap-3">
          {!isActive ? (
            <button
              onClick={start}
              className="w-full py-4 rounded-2xl text-white text-lg font-bold cv-btn-primary"
            >
              🎙️ Empezar entrevista
            </button>
          ) : (
            <button
              onClick={stop}
              className="w-full py-4 rounded-2xl text-white text-lg font-bold cv-btn-stop"
            >
              ⏹ Terminar
            </button>
          )}
          <p className="text-xs text-center" style={{ color: '#94A3B8' }}>
            Habla con naturalidad&nbsp;·&nbsp;Haz una pausa para enviar&nbsp;·&nbsp;
            <kbd
              className="px-1.5 py-0.5 rounded"
              style={{ background: '#EFF6FF', border: '1px solid rgba(26,115,232,0.25)', color: '#1A73E8' }}
            >
              Espacio
            </kbd>
          </p>
        </div>

      </div>
    </div>
  )
}
