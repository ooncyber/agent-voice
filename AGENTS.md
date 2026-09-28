# AGENTS.md

Asterisk + Node ARI voice agent POC. See `README.md` for setup and run instructions — this file is operational knowledge for anyone (agent or human) changing the code, not discoverable by reading the config alone.

## Rebuilding after config changes

`docker/asterisk/etc/*.conf` are `COPY`'d into the image at build time, not bind-mounted. Editing them does nothing until:
```bash
docker compose up -d --build asterisk
```
A plain `docker compose restart` will not pick up the change.

## PJSIP object naming — do not rename the AOR

`pjsip.conf`'s endpoint, auth, and AOR for extension `1000` all share the section id `[1000]` (auth is the exception, `1000-auth`). This is required, not stylistic: when a softphone REGISTERs with no user part in the Request-URI (`REGISTER sip:host`, which is normal SIP, not a misconfigured client), `res_pjsip_registrar` resolves the target AOR by name-matching the endpoint's extension, not by iterating `aors=`. Name the AOR anything other than the endpoint's own id (e.g. `1000-aor`) and registration authenticates fine but 404s with `AOR '' not found`.

## Audio played back into a call must match the call's sample rate

The call itself is 8kHz (`allow = ulaw,alaw` in `pjsip.conf`). Two ways to feed `channel.play()` a file that isn't already 8kHz:
- `.wav` — must be exactly 8000Hz. `format_wav.c` hard-rejects anything else (`Unexpected frequency mismatch`), it does not resample.
- raw PCM saved with a `.sln<rate>` extension (e.g. Kokoro's native 24kHz → `.sln24`) — Asterisk auto-transcodes `slin*` to the call's codec. This is what `server/src/ai.js` / `server/src/call.js` do: `generateSpeech({ outputFormat: 'pcm' })`, written to `<soundsDir>/<name>.sln24`.

If you swap the TTS provider or change `outputFormat`, this is the thing that breaks silently (call connects, no error, caller just never hears a reply).

## `/var/spool/asterisk/recording` must exist

Not created by the `asterisk` apt package. Missing it makes `channel.record()` fail with a bare `500 Internal Server Error` from ARI with no useful detail — the real reason (`No such file or directory`) only shows up in the Asterisk container's own log, not the ARI response. Created explicitly in `docker/asterisk/Dockerfile`; don't remove that line.

## `agent` container crash-restarts once on cold start — expected

`ari-client`'s underlying `swagger-client` throws a synchronous, uncatchable exception (not a promise rejection) if it hits Asterisk's ARI before `res_ari` has finished loading. Don't try to fix this with a try/catch or a readiness-poll in `index.js` — it doesn't help because the throw happens outside the promise chain. The actual fix is `restart: on-failure` on the `agent` service in `docker-compose.yml`: it dies once, Asterisk is warm by the second attempt, done.

## `EXTERNAL_MEDIA_ADDRESS` must be a real, reachable IP

Set via `docker-compose.yml` → `docker/asterisk/Dockerfile`'s entrypoint (`sed`-substitutes it into `pjsip.conf` at container start, since the file itself only ships a `YOUR_HOST_IP` placeholder for the public repo). If unset or wrong, Asterisk advertises its own container-internal IP in SDP — calls connect and register fine, but the softphone can't reach that address to send/receive RTP, so it's silent in both directions.

## Windows / git-bash: path conversion breaks `docker exec` with absolute paths

`docker compose exec asterisk ls /var/spool/asterisk/...` gets silently mangled into a `C:/...` path by git-bash's MSYS path conversion before it ever reaches Docker. Prefix with `MSYS_NO_PATHCONV=1` whenever passing an absolute Unix path as a command argument to `docker exec`/`docker compose exec`.

## Testing the call loop without a phone

`faketest` extension in `extensions.conf` (dev-only, marked `ponytail:`) plays `docker/asterisk/sounds/custom/test-question.*` as a fake caller, bridged into the real `600@agent` flow via a `Local` channel:
```bash
docker compose exec asterisk asterisk -rx "channel originate Local/600@agent extension faketest@agent"
```
Exercises the full record → STT → LLM → TTS → playback loop. Regenerate the test file with Kokoro directly if you need different test speech — remember it needs the same `.sln24` (raw PCM) treatment as real replies, not `.wav`, or `Playback` fails the same way.

## Secrets

`.env` / `server/.env` are gitignored and hold real credentials. `.env.example` / `server/.env.example` are committed and must only ever contain placeholders (`changeme`, `192.168.1.100`, etc.) — never paste a real key or LAN IP into a tracked file. `server/src/config.js` has no hardcoded credential fallbacks; keep it that way.

## Stack

Plain JS, ESM, Node's own `--env-file-if-exists`, no TypeScript/bundler/framework. `ai` + `@ai-sdk/openai` cover chat, transcription, and speech through one SDK by pointing `createOpenAI({ baseURL })` at three different OpenAI-compatible servers (your LLM proxy, `speaches`, Kokoro). Don't add a second HTTP client or SDK for any of the three — if a provider needs something the AI SDK's `transcribe`/`generateSpeech` can't express, that's a sign to re-check the provider's OpenAI-compatibility rather than reach for a new dependency.
