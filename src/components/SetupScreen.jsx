import { useState } from 'react'
import logo from '../public/img/logoCV.png'
import { SECTORS, LEVELS, ROLE_SUGGESTIONS } from '../config/interviewer'

const GENDERS = [
  { id: 'mujer',   label: 'Mujer' },
  { id: 'hombre',  label: 'Hombre' },
  { id: 'neutro',  label: 'Prefiero no indicar' },
]

export default function SetupScreen({ onStart, initialConfig }) {
  const [name,   setName]   = useState(initialConfig?.name   ?? '')
  const [gender, setGender] = useState(initialConfig?.gender ?? 'neutro')
  const [role,   setRole]   = useState(initialConfig?.role   ?? '')
  const [sector, setSector] = useState(initialConfig?.sector ?? 'tech')
  const [level,  setLevel]  = useState(initialConfig?.level  ?? 'media')

  const canStart = role.trim().length >= 2

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!canStart) return
    onStart({ role: role.trim(), sector, level, name: name.trim(), gender })
  }

  const suggestions = ROLE_SUGGESTIONS[sector] ?? []

  const pillStyle = (active) => active
    ? { background: 'linear-gradient(135deg,#FF6D00,#1A73E8)', color: 'white', boxShadow: '0 2px 12px rgba(26,115,232,0.28)' }
    : { background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1A73E8' }

  return (
    <div className="cv-bg min-h-screen flex flex-col items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md cv-card rounded-3xl shadow-2xl overflow-hidden cv-glow-blue"
      >
        {/* Header */}
        <div className="cv-header px-5 py-5 flex items-center gap-3">
          <img
            src={logo}
            alt="EntrevistaCV"
            className="w-12 h-12 rounded-xl object-contain bg-white p-0.5"
            style={{ boxShadow: '0 1px 4px rgba(26,115,232,0.15)' }}
          />
          <div>
            <h1 className="cv-title-gradient text-lg">EntrevistaCV</h1>
            <p className="text-xs" style={{ color: '#64748B' }}>
              Practica entrevistas de trabajo por voz con IA
            </p>
          </div>
        </div>

        <div className="px-5 py-5 space-y-5">

          {/* Datos personales */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold" style={{ color: '#1A73E8' }}>
              Tu nombre <span style={{ color: '#94A3B8', fontWeight: 400 }}>(opcional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: María, Carlos…"
              className="w-full rounded-2xl px-4 py-3 text-sm cv-input"
              autoComplete="given-name"
            />

            <label className="block text-xs font-semibold mt-1" style={{ color: '#1A73E8' }}>
              Cómo quieres que te traten
            </label>
            <div className="grid grid-cols-3 gap-2">
              {GENDERS.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGender(g.id)}
                  className="text-xs rounded-xl px-2 py-2.5 font-medium transition-all"
                  style={pillStyle(gender === g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sector */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#1A73E8' }}>
              Sector
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SECTORS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSector(s.id); setRole('') }}
                  className="text-xs rounded-xl px-2 py-2.5 font-medium transition-all"
                  style={pillStyle(sector === s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Puesto */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#1A73E8' }}>
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
                    style={pillStyle(role === s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nivel */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#1A73E8' }}>
              Nivel
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LEVELS.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLevel(l.id)}
                  className="text-xs rounded-xl px-3 py-3 font-medium transition-all flex flex-col items-center gap-0.5"
                  style={pillStyle(level === l.id)}
                >
                  <span className="font-bold">{l.label}</span>
                  <span style={{ fontSize: '10px', opacity: 0.85, lineHeight: 1.3, textAlign: 'center' }}>{l.hint}</span>
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

          <p className="text-xs text-center leading-relaxed" style={{ color: '#94A3B8' }}>
            La entrevista es completamente por voz · Habla, haz una pausa y la IA te responderá
            <br />Permite el uso del micrófono cuando lo solicite el navegador
          </p>

        </div>
      </form>
    </div>
  )
}
