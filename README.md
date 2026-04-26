# English Chat App - Practica Inglés Básico

Chat en tiempo real con IA para aprender inglés nivel A1-A2. Usa Groq API (gratuita).

## Pasos para correr

### 1. Obtén tu API Key de Groq (GRATIS)
1. Ve a https://console.groq.com
2. Regístrate o inicia sesión
3. Haz clic en **"API Keys"** → **"Create API Key"**
4. Copia la key generada

### 2. Configura el archivo .env
```bash
cp .env.example .env
```
Edita `.env` y reemplaza `your_groq_api_key_here` con tu key real:
```
VITE_GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Instala dependencias
```bash
npm install
```

### 4. Corre la app
```bash
npm run dev
```
Abre http://localhost:5173 en tu navegador.

## Estructura
```
src/
  hooks/
    useChat.js          # Maneja API calls y estado de mensajes
    useBasicEnglish.js  # Simplifica vocabulario complejo
  components/
    ChatMessage.jsx     # Burbuja de mensaje
    ChatInput.jsx       # Input de texto con botón enviar
  App.jsx               # Componente principal
  main.jsx              # Entry point
```

## Características
- Chat en inglés básico (A1-A2)
- Corrección gentil de errores gramaticales
- Botones de ejemplo para empezar rápido
- Indicador de "escribiendo..."
- Limpiar chat con un clic
- Mobile-first responsive
# AppCVReact
