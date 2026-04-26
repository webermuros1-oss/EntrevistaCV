# EntrevistaCV — Practica entrevistas de trabajo por voz con IA

PWA mobile-first para simular entrevistas de trabajo reales en español, completamente por voz. Usa Groq API (gratuita) con Llama 3.1 para generar las preguntas y Web Speech API para el reconocimiento y síntesis de voz.

---

## Cómo funciona

1. El usuario elige **sector**, **puesto** y **dificultad** (Junior / Media / Senior)
2. La entrevistadora IA se presenta y lanza la primera pregunta en voz alta
3. El usuario responde hablando — la app espera **2.8 segundos de silencio real** antes de enviar (pensado para gente que necesita un momento para ordenar ideas)
4. Si haces una pausa breve a mitad de respuesta, el micrófono se reabre solo y el texto se acumula hasta que terminas de hablar
5. La IA responde con la siguiente pregunta o profundiza en tu respuesta

---

## Sectores y niveles disponibles

| Sector | Ejemplos de puesto |
|---|---|
| Tecnología | Full Stack, Frontend React, Backend Node.js, DevOps, Data Engineer |
| Restauración | Camarero/a, Cocinero/a, Maître, Jefe de cocina |
| Comercial / Ventas | Comercial B2B, Account Manager, KAM |
| Atención al cliente | Agente call center, Customer Success, Técnico soporte |
| Administración | Administrativo/a, Contable, Office Manager |
| Otro | Libre |

**Dificultad Junior** — preguntas de fundamentos, motivación, proyectos personales  
**Dificultad Media** — experiencia concreta, decisiones tomadas, resultados medibles  
**Dificultad Senior** — arquitectura, liderazgo, trade-offs, impacto en negocio

---

## Instalación y uso local

### 1. Obtén tu API key de Groq (gratis)

1. Ve a [console.groq.com](https://console.groq.com)
2. Regístrate o inicia sesión
3. Haz clic en **API Keys** → **Create API Key**
4. Copia la key generada

### 2. Crea el archivo `.env`

```bash
cp .env.example .env
```

Edita `.env`:

```
VITE_GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Instala dependencias

```bash
npm install
```

### 4. Arranca en local

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en **Chrome o Edge** (son los únicos navegadores que soportan Web Speech API).

> **iOS Safari no está soportado** — el reconocimiento de voz no existe en iOS. Usar Chrome en Android o desde un ordenador.

---

## Despliegue en Vercel

La API key se expone al cliente en desarrollo (variable `VITE_`). En producción la llamada pasa por una serverless function de Vercel para que la key nunca salga al navegador.

```bash
vercel deploy
```

Añade la variable de entorno `GROQ_API_KEY` (sin prefijo `VITE_`) en el dashboard de Vercel → Settings → Environment Variables.

---

## Estructura del proyecto

```
api/
  chat.js                    # Serverless function — proxy seguro a Groq (producción)

src/
  config/
    interviewer.js           # Sectores, niveles, sugerencias de puesto y builder del system prompt

  hooks/
    useVoiceConversation.js  # Lógica central: SR lifecycle, TTS, Groq API, debounce de envío

  components/
    SetupScreen.jsx          # Pantalla de configuración (sector / puesto / dificultad)
    VoiceUI.jsx              # Pantalla de entrevista con orb animado

  App.jsx                    # Gate: muestra setup o entrevista según localStorage
  main.jsx                   # Entry point
  index.css                  # Design system (paleta azul/naranja del logo)

public/
  logoCV.png                 # Logo de la app (también usado como icono PWA)
```

---

## Detalles técnicos

### Estabilidad del micrófono en móvil

El hook `useVoiceConversation` resuelve los problemas habituales de `SpeechRecognition` en Android:

- **Una sola instancia SR activa** (`recRef`) — antes de crear una nueva se hace `.abort()` + se nullean todos los callbacks para que `onend` no relance nada
- **Guard `startingRef`** — mutex que impide crear dos instancias en paralelo aunque haya doble tap o retries rápidos
- **`start()` idempotente** — segundo tap ignorado si la sesión ya está activa
- **Espera de silencio real tras TTS** — polling de `speechSynthesis.speaking` + `pending` en lugar de un `setTimeout` fijo, para no abrir el micro mientras el altavoz aún suena
- **Unlock de TTS en gesto de usuario** — se hace `speak('')` silencioso en el click de "Empezar" para que Android Chrome no bloquee el primer habla real de la IA
- **`AbortController` en cada llamada Groq** — al pulsar "Terminar" se cancela el fetch en vuelo

### Acumulación de texto multi-segmento

Con `continuous: false`, el navegador reinicia el reconocimiento en cada pausa natural. Cada fragmento final se **acumula** al anterior durante 2.8s de silencio antes de enviarse a la IA — así el usuario puede hablar con pausas sin que la respuesta se trunque.

### System prompt por sector y nivel

`buildInterviewPrompt()` en `interviewer.js` genera un prompt con:
- Guía específica de sector (preguntas técnicas para tech, operativas para restauración, etc.)
- Guía de nivel (Junior: fundamentos; Media: experiencia real; Senior: arquitectura y liderazgo)
- Restricciones de formato para TTS (máximo 80 palabras, sin markdown, prosa hablada)

---

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 18 + Vite + Tailwind CSS (CDN) |
| IA conversacional | Groq API — Llama 3.1 8B Instant |
| Reconocimiento de voz | Web Speech API (`SpeechRecognition`) |
| Síntesis de voz | Web Speech API (`SpeechSynthesis`) |
| PWA | vite-plugin-pwa + Workbox |
| Despliegue | Vercel (serverless function para proxy de API) |
