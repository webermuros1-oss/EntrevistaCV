import { useState } from 'react'
import logo from '../public/img/logoCV.png'
import { SECTORS, LEVELS, ROLE_SUGGESTIONS } from '../config/interviewer'

export default function SetupScreen({ onStart }) {
  const [role,   setRole]   = useState('')
  const [sector, setSector] = useState('tech')
  const [level,  setLevel]  = useState('media')

  const canStart = role.trim().length >= 2

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!canStart) return
    onStart({ role: role.trim(), sector, level })
  }

  const suggestions = ROLE_SUGGESTIONS[sector] ?? []

  return (
    <div className="cv-bg min-h-screen flex flex-col items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md cv-card rounded-3xl shadow-2xl overflow-hidden cv-glow-blue"
      >
        {/* Header */}
        <div className="cv-header px-5 py-5 flex items-center gap-3">
          <img src={logo} alt="EntrevistaCV" className="w-12 h-12 rounded-xl object-contain bg-white p-0.5" />
          <div>
            <h1 className="cv-title-gradient text-lg">EntrevistaCV</h1>
            <p className="text-xs" style={{ color: 'rgba(147,197,253,0.7)' }}>
              Practica entrevistas de trabajo por voz con IA
            </p>
          </div>
        </div>

        <div className="px-5 py-5 space-y-5">

          {/* Sector */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#4D9EFF' }}>
              Sector
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SECTORS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSector(s.id); setRole('') }}
                  className="text-xs rounded-xl px-2 py-2.5 font-medium transition-all"
                  style={sector === s.id
                    ? { background: 'linear-gradient(135deg,#FF6D00,#1A73E8)', color: 'white', boxShadow: '0 2px 12px rgba(26,115,232,0.35)' }
                    : { background: 'rgba(26,115,232,0.1)', border: '1px solid rgba(26,115,232,0.28)', color: 'rgba(147,197,253,0.85)' }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Puesto */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#4D9EFF' }}>
              ¿A qué puesto te postulas?
            </label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit() } }}
              placeholder="Escribe el puesto…"
              className="w-full rounded-2xl px-4 py-3 text-sm cv-input"
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {suggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRole(s)}
                    className="text-xs rounded-full px-3 py-1 transition-all active:scale-95"
                    style={{
                      background: role === s
                        ? 'linear-gradient(135deg,#FF6D00,#1A73E8)'
                        : 'rgba(26,115,232,0.1)',
                      border: role === s ? 'none' : '1px solid rgba(26,115,232,0.28)',
                      color: role === s ? 'white' : '#4D9EFF',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dificultad */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#4D9EFF' }}>
              Dificultad
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LEVELS.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLevel(l.id)}
                  className="text-xs rounded-xl px-3 py-3 font-medium transition-all flex flex-col items-center gap-0.5"
                  style={level === l.id
                    ? { background: 'linear-gradient(135deg,#FF6D00,#1A73E8)', color: 'white', boxShadow: '0 2px 12px rgba(26,115,232,0.35)' }
                    : { background: 'rgba(26,115,232,0.1)', border: '1px solid rgba(26,115,232,0.28)', color: 'rgba(147,197,253,0.85)' }
                  }
                >
                  <span className="font-bold">{l.label}</span>
                  <span style={{ fontSize: '10px', opacity: 0.8, lineHeight: 1.2, textAlign: 'center' }}>{l.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            type="submit"
            disabled={!canStart}
            className="w-full py-4 rounded-2xl text-white text-base font-bold cv-btn-primary"
          >
            🎙️ Empezar entrevista
          </button>

          <p className="text-xs text-center leading-relaxed" style={{ color: 'rgba(100,160,220,0.5)' }}>
            La entrevista es completamente por voz · Habla, haz una pausa y la IA te responderá
            <br />Permite el uso del micrófono cuando lo solicite el navegador
          </p>

        </div>
      </form>
    </div>
  )
}
