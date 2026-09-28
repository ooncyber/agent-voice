export const config = {
  ari: {
    url: process.env.ARI_URL ?? 'http://localhost:8088',
    user: process.env.ARI_USER ?? 'asterisk',
    password: process.env.ARI_PASSWORD ?? 'asterisk',
    app: process.env.ARI_APP ?? 'voice-agent',
  },
  // Chat model: local litellm proxy (OpenAI-compatible /v1/chat/completions).
  llm: {
    baseURL: process.env.LLM_BASE_URL ?? 'http://127.0.0.1:4001/v1',
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL ?? 'claude-mantle-glm-5',
  },
  // STT: local speaches (faster-whisper) server, OpenAI-compatible, free/offline.
  stt: {
    baseURL: process.env.STT_BASE_URL ?? 'http://127.0.0.1:8000/v1',
    model: process.env.STT_MODEL ?? 'Systran/faster-whisper-small',
  },
  // TTS: local Kokoro server, OpenAI-compatible, free/offline. pf_dora = Portuguese (BR) voice.
  tts: {
    baseURL: process.env.TTS_BASE_URL ?? 'http://127.0.0.1:8880/v1',
    model: process.env.TTS_MODEL ?? 'kokoro',
    voice: process.env.TTS_VOICE ?? 'pf_dora',
  },
  soundsDir: process.env.SOUNDS_DIR ?? './sounds',
};
