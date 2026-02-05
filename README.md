# otter
voice to text

## Prototype setup
This repository now includes a minimal prototype that implements the system plan:

- REST endpoints for session creation and lifecycle.
- WebSocket gateway for realtime transcript events.
- A lightweight frontend for host/viewer flows, including mic capture.

### Run locally
```bash
npm install
npm start
```

Open `http://localhost:3000` to create a session and share the link.
