import { mkdir } from 'node:fs/promises';
import ari from 'ari-client';
import { config } from './config.js';
import { handleCall } from './call.js';

// ponytail: generated reply-*.wav files in soundsDir are never cleaned up; add a TTL sweep if disk fills up.
await mkdir(config.soundsDir, { recursive: true });

// ari-client throws an uncatchable exception (not a rejected promise) if Asterisk's
// HTTP/ARI stack isn't fully warmed up yet. docker-compose's restart policy handles
// the retry instead of fighting the library's broken error handling in-process.
const client = await ari.connect(config.ari.url, config.ari.user, config.ari.password);

client.on('StasisStart', (event, channel) => {
  console.log(`[${channel.id}] incoming call`);
  handleCall(client, channel);
});

client.on('StasisEnd', (event, channel) => {
  console.log(`[${channel.id}] call ended`);
});

await client.start(config.ari.app);
console.log(`ARI app "${config.ari.app}" started, connected to ${config.ari.url}`);
