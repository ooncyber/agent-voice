# agent-voice

Phone-call POC: dial in from a SIP softphone (Zoiper, MicroSIP...), talk to an LLM agent, hear it talk back. Asterisk handles the call, a Node.js app drives it over ARI, and the LLM/STT/TTS loop replies in real time.

```
Zoiper --SIP/RTP--> Asterisk (docker) --ARI (ws/http)--> agent (Node)
                                                              |
                                                    LLM (your litellm proxy, on the host)
                                                    STT (speaches, local, free)
                                                    TTS (Kokoro, local, free)
```

Call flow: dial in → `Stasis` app answers → record until silence → transcribe → send to the LLM → synthesize the reply → play it back → listen again. Turn-based, not full-duplex (no barge-in).

## Prerequisites

- Docker Desktop
- A SIP softphone (Zoiper, MicroSIP, Linphone...)
- An OpenAI-compatible chat completions endpoint (e.g. a local [litellm](https://github.com/BerriAI/litellm) proxy). STT/TTS run locally in Docker — no cloud key needed for those.

## Setup

1. Copy the env file and fill it in:
   ```bash
   cp .env.example .env
   ```
   - `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` — your OpenAI-compatible chat endpoint. If it runs on your host machine (not in Docker), use `http://host.docker.internal:PORT/v1`, not `127.0.0.1`.
   - `EXTERNAL_MEDIA_ADDRESS` — your machine's LAN IP (`ipconfig` / `ip addr`). Asterisk advertises this in SDP so your softphone knows where to send audio. Get this wrong and calls connect but stay silent.

2. Build and start everything:
   ```bash
   docker compose up -d --build
   ```

3. One-time: download the STT model (cached afterwards in the `stt-cache` volume):
   ```bash
   curl -X POST http://localhost:8000/v1/models/Systran/faster-whisper-small
   ```

4. Add a SIP account in your softphone — skip any "create a cloud account" prompt and add a manual/generic SIP account instead:
   - Username: `1000`
   - Password: `changeme1000` (see `docker/asterisk/etc/pjsip.conf`)
   - Server: your machine's IP (or `localhost` if the softphone runs on the same machine), port `5060`, UDP

5. Dial **500** — echo test, confirms audio works with no app logic involved.
   Dial **600** — talk to the agent.

## Project layout

```
docker/asterisk/       Asterisk image: pjsip (SIP), extensions (dialplan), ari/http (ARI)
server/                Node.js ARI app (plain JS, ESM, no framework)
  src/config.js         env vars -> config
  src/ai.js             LLM (chat) + STT (transcribe) + TTS (speech), all via the Vercel AI SDK
  src/call.js           per-call loop: record -> STT -> LLM -> TTS -> play
  src/index.js          ARI connection + StasisStart wiring
```

## Environment variables

| Var | Where | Purpose |
|---|---|---|
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | root `.env` | Your chat model, OpenAI-compatible |
| `EXTERNAL_MEDIA_ADDRESS` | root `.env` | LAN IP Asterisk advertises for RTP/SIP |
| `STT_MODEL` | `server/.env.example` | faster-whisper model id (speaches) |
| `TTS_VOICE` | `server/.env.example` | Kokoro voice id (`pf_dora` = Portuguese/BR female) |

`server/.env.example` also documents running the Node app outside Docker, against the dockerized `stt`/`tts` services published on `localhost`.

## Troubleshooting

- **Registration fails with 401** — password mismatch. Check what your softphone actually sent, not what you think you typed.
- **Call connects but no audio at all** — `EXTERNAL_MEDIA_ADDRESS` is wrong or unset; Asterisk is advertising an address your phone can't reach (e.g. the container's internal Docker IP).
- **Agent container restarts once on first boot** — expected. `ari-client` throws before Asterisk's ARI is fully warmed up; `restart: on-failure` in `docker-compose.yml` retries and it settles within a few seconds.
- **You hear the beep but never a reply** — check `docker compose logs agent`. Likely STT returned no transcript (you didn't speak long/clear enough after the beep) or the LLM/TTS call failed (check `LLM_BASE_URL` reachability from inside the container).

### Testing without a phone

`docker/asterisk/etc/extensions.conf` has a `faketest` extension that plays `docker/asterisk/sounds/custom/test-question.*` as a fake caller, bridged into the real `600` flow — lets you exercise record → STT → LLM → TTS → playback without picking up a phone:

```bash
docker compose exec asterisk asterisk -rx "channel originate Local/600@agent extension faketest@agent"
docker compose logs -f agent
```

## Status

Proof of concept. Single call at a time, no auth beyond the one SIP account, generated reply audio files are never cleaned up.
