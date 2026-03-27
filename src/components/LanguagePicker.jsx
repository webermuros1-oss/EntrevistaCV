import { LANGUAGES } from '../config/languages'

export default function LanguagePicker({ selected, onChange }) {
  return (
    <div className="w-full px-2">
      <p className="text-center text-xs font-medium mb-3"
         style={{ color: 'rgba(180,160,220,0.6)' }}>
        Choose a language to learn
      </p>
      <div className="grid grid-cols-3 gap-2">
        {Object.values(LANGUAGES).map(lang => {
          const isSelected = selected === lang.code
          return (
            <button
              key={lang.code}
              onClick={() => onChange(lang.code)}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-2xl transition-all active:scale-95"
              style={isSelected
                ? {
                    background: 'linear-gradient(135deg,#FF6B00,#7B2FFF)',
                    boxShadow: '0 4px 20px rgba(255,107,0,0.4)',
                  }
                : {
                    background: 'rgba(123,47,255,0.08)',
                    border: '1px solid rgba(123,47,255,0.2)',
                  }
              }
            >
              <span className="text-3xl leading-none">{lang.flag}</span>
              <span className="text-sm font-bold leading-none"
                    style={{ color: isSelected ? 'white' : 'rgba(200,180,255,0.9)' }}>
                {lang.nativeName}
              </span>
              <span className="text-xs leading-none"
                    style={{ color: isSelected ? 'rgba(255,255,255,0.75)' : 'rgba(160,140,210,0.5)' }}>
                {lang.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
