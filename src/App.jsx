import { useState, useRef } from 'react'
import SetupScreen from './components/SetupScreen'
import VoiceUI from './components/VoiceUI'

const STORAGE_KEY = 'entrevistapro-config-v1'

const loadSaved = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const cfg = JSON.parse(raw)
    if (cfg?.role && cfg?.sector && cfg?.level) return cfg
  } catch { /* quota / private mode */ }
  return null
}

export default function App() {
  // Always start on SetupScreen — never skip it on load
  const [config, setConfig] = useState(null)
  // Pre-fill the form with the last saved values (read once, stable ref)
  const initialConfig = useRef(loadSaved()).current

  const handleStart = (cfg) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)) } catch { /* ignore */ }
    setConfig(cfg)
  }

  const handleChangeSetup = () => setConfig(null)

  return config
    ? <VoiceUI config={config} onChangeSetup={handleChangeSetup} />
    : <SetupScreen onStart={handleStart} initialConfig={initialConfig} />
}
