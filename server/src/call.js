import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { reply, speechToText, textToSpeech } from './ai.js';

function waitForRecording(ari, name) {
  return new Promise((resolve) => {
    function onFinished(event) {
      if (event.recording.name !== name) return;
      ari.removeListener('RecordingFinished', onFinished);
      ari.recordings.getStoredFile({ recordingName: name }).then(resolve).catch(() => resolve(null));
    }
    ari.on('RecordingFinished', onFinished);
  });
}

function playSound(ari, channel, media) {
  return new Promise((resolve, reject) => {
    const playback = ari.Playback();
    playback.once('PlaybackFinished', resolve);
    channel.play({ media }, playback).catch(reject);
  });
}

export function handleCall(ari, channel) {
  const history = [];
  let ended = false;

  channel.once('StasisEnd', () => {
    ended = true;
  });

  channel
    .answer()
    .then(() => turn())
    .catch((err) => console.error('call setup failed', err));

  async function turn() {
    if (ended) return;

    const recordingName = `call-${channel.id}-${Date.now()}`;
    try {
      await channel.record({
        name: recordingName,
        format: 'wav',
        maxDurationSeconds: 15,
        maxSilenceSeconds: 2,
        beep: true,
        ifExists: 'overwrite',
      });
    } catch (err) {
      console.error('record failed', err);
      return;
    }

    const audio = await waitForRecording(ari, recordingName);
    if (ended || !audio) return;

    let heard = '';
    try {
      heard = await speechToText(audio);
    } catch (err) {
      console.error('speechToText failed', err);
    }

    if (!heard?.trim()) {
      if (!ended) await turn();
      return;
    }

    console.log(`[${channel.id}] caller said: ${heard}`);
    history.push({ role: 'user', content: heard });

    let answer;
    try {
      answer = await reply(history);
    } catch (err) {
      console.error('reply failed', err);
      return;
    }
    console.log(`[${channel.id}] agent: ${answer}`);
    history.push({ role: 'assistant', content: answer });

    try {
      const speech = await textToSpeech(answer);
      const soundName = `reply-${randomUUID()}`;
      await writeFile(path.join(config.soundsDir, `${soundName}.sln24`), speech);
      await playSound(ari, channel, `sound:custom/${soundName}`);
    } catch (err) {
      console.error('textToSpeech/playback failed', err);
      return;
    }

    if (!ended) await turn();
  }
}
