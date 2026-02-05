# Voice-to-Text Link Sharing System Plan

## Goal
Create an Otter-like experience where a speaker opens a unique link, grants microphone access, and speaks. The system transcribes their speech in real time and streams the text to anyone viewing the shared link. Viewers only need the link—no login, no mic, no app install.

## Non-Goals (MVP)
- No user accounts or saved workspaces.
- No multi-speaker diarization.
- No playback or editing UI.

## Key User Flows
1. **Host creates session**
   - Host clicks “New Session”.
   - Backend creates a session record and returns a shareable URL.
2. **Host speaks**
   - Host opens the session page, grants mic access.
   - Audio is streamed to the backend for transcription.
   - Live text appears for host and viewers.
3. **Viewers join**
   - Viewers open the shared link.
   - They see the live transcript and (optionally) the audio waveform or status.
4. **Host ends session**
   - Host stops recording.
   - Backend marks session as ended and broadcasts final status.

## Core Requirements
- **Real-time transcription** from microphone input.
- **Shareable link** that joins the session with no sign-in.
- **Live updates** to all connected viewers.
- **Low latency** streaming: audio → transcription → broadcast.
- **Session lifecycle**: create, active, ended, archived.
- **Graceful reconnection** for host/viewers on network loss.

## High-Level Architecture
### Frontend
- **Host UI**
  - Start/stop recording controls.
  - Permissions prompt.
  - Live transcript display.
  - Shareable link copy button.
  - Connection status indicator.
- **Viewer UI**
  - Live transcript display (read-only).
  - Session status (live/ended).
  - Connection status indicator.
- **Streaming layer**
  - WebSocket connection to receive transcript updates.
  - Host also uses WebSocket or WebRTC for audio streaming.

### Backend
- **Session API**
  - `POST /sessions` → creates session, returns `sessionId` + `shareUrl`.
  - `GET /sessions/:id` → session metadata/status.
  - `POST /sessions/:id/end` → ends session.
- **Realtime Gateway**
  - WebSocket server handling:
    - Host audio streaming.
    - Transcript broadcast to viewers.
- **Transcription Service**
  - Pluggable voice-to-text model (e.g., Whisper, Deepgram, AssemblyAI).
  - Receives streaming audio, returns partial and final text.
- **Storage**
  - Session metadata and transcript history.

### Data Flow (Live)
1. Host mic → audio chunks sent via WebSocket/WebRTC.
2. Backend forwards audio to transcription engine.
3. Transcription engine sends partial/final text back.
4. Backend broadcasts transcript events to all session viewers.
5. On end, backend sends `session.status=ended`.

## Session Model (Suggested)
```
Session {
  id: string
  createdAt: timestamp
  status: "active" | "ended"
  endedAt?: timestamp
  shareUrl: string
  transcript: TranscriptEntry[]
}

TranscriptEntry {
  id: string
  startTimeMs: number
  endTimeMs: number
  text: string
  isFinal: boolean
  confidence?: number
}
```

## API & Realtime Events (Suggested)
### REST
- `POST /sessions`
  - Response: `{ sessionId, shareUrl }`
- `POST /sessions/:id/end`
  - Ends session
- `GET /sessions/:id`
  - Returns metadata and transcript history

### WebSocket Events
**Host → Server**
- `audio.chunk` `{ sessionId, audioBuffer, sequence }`
- `session.ping` `{ sessionId, timestamp }`

**Server → Clients**
- `transcript.partial` `{ sessionId, text, startTimeMs }`
- `transcript.final` `{ sessionId, text, startTimeMs, endTimeMs }`
- `session.status` `{ sessionId, status }`
- `session.error` `{ sessionId, code, message }`

## Voice-to-Text Model Options
1. **OpenAI Whisper**
   - Pros: high accuracy, open-source.
   - Cons: resource heavy, higher latency unless optimized.
2. **Managed APIs (Deepgram / AssemblyAI / Google STT)**
   - Pros: low latency, scalable.
   - Cons: usage cost, vendor lock-in.

## Scaling Considerations
- **Fan-out**: use pub/sub (Redis, NATS) to broadcast transcripts to many viewers.
- **Audio stream handling**: limit chunk size, compress (e.g., Opus).
- **Rate limits**: limit concurrent sessions per user/IP.
- **Transcript storage**: keep in DB for playback or export.
- **Regional routing**: keep transcription service close to users for latency.

## Security & Privacy
- **Unlisted links** (unguessable IDs).
- Optional passcode for private sessions.
- TLS everywhere for audio + transcripts.
- Data retention controls (auto-delete after X days).
- Disable search indexing of session pages.

## MVP Build Plan
1. Backend session service + WebSocket gateway.
2. Basic host UI with mic capture + streaming.
3. Viewer UI with live transcript updates.
4. Integrate a transcription provider (start with managed API for speed).
5. Add session archive + export.
6. Add end-session flow and status handling.

## Nice-to-Haves
- Speaker labeling (diarization).
- Multi-language support.
- Export to text/PDF/SRT.
- Basic analytics (duration, word count).
