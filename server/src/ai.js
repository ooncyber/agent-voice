import { createOpenAI } from '@ai-sdk/openai';
import { generateText, transcribe, generateSpeech } from 'ai';
import { config } from './config.js';

const llm = createOpenAI({
  baseURL: config.llm.baseURL,
  apiKey: config.llm.apiKey,
});

// Local, free, OpenAI-compatible servers (speaches for STT, Kokoro for TTS) — no cloud key needed.
const stt = createOpenAI({ baseURL: config.stt.baseURL, apiKey: 'local' });
const tts = createOpenAI({ baseURL: config.tts.baseURL, apiKey: 'local' });

export async function reply(history) {
  const { text } = await generateText({
    model: llm(config.llm.model),
    system: 'You are a helpful voice assistant on a phone call. Keep answers short and conversational.',
    messages: history,
  });
  return text;
}

export async function speechToText(audioBuffer) {
  const { text } = await transcribe({
    model: stt.transcription(config.stt.model),
    audio: audioBuffer,
  });
  return text;
}

// Kokoro's native rate is 24kHz. Asterisk's format_wav rejects anything but 8kHz wav,
// but raw slin24 (.sln24) gets auto-transcoded to the call's codec — so ask for raw PCM.
export async function textToSpeech(text) {
  const { audio } = await generateSpeech({
    model: tts.speech(config.tts.model),
    text,
    voice: config.tts.voice,
    outputFormat: 'pcm',
  });
  return Buffer.from(audio.uint8Array);
}
