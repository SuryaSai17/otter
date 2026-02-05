const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const { nanoid } = require("nanoid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const sessions = new Map();
const sessionClients = new Map();

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const createSession = () => {
  const id = nanoid(12);
  const createdAt = new Date().toISOString();
  const session = {
    id,
    createdAt,
    status: "active",
    endedAt: null,
    transcript: []
  };
  sessions.set(id, session);
  sessionClients.set(id, new Set());
  return session;
};

const broadcast = (sessionId, message) => {
  const clients = sessionClients.get(sessionId);
  if (!clients) {
    return;
  }
  const payload = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
};

app.post("/sessions", (req, res) => {
  const session = createSession();
  res.json({
    sessionId: session.id,
    shareUrl: `${req.protocol}://${req.get("host")}/?session=${session.id}`
  });
});

app.get("/sessions/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

app.post("/sessions/:id/end", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  session.status = "ended";
  session.endedAt = new Date().toISOString();
  broadcast(session.id, { type: "session.status", sessionId: session.id, status: session.status });
  res.json({ ok: true, session });
});

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get("session");
  const role = url.searchParams.get("role") || "viewer";

  if (!sessionId || !sessions.has(sessionId)) {
    ws.send(JSON.stringify({ type: "session.error", code: "not_found", message: "Session not found" }));
    ws.close();
    return;
  }

  const clients = sessionClients.get(sessionId);
  clients.add(ws);

  ws.send(
    JSON.stringify({
      type: "session.status",
      sessionId,
      status: sessions.get(sessionId).status
    })
  );

  ws.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      ws.send(JSON.stringify({ type: "session.error", code: "bad_json", message: "Invalid JSON" }));
      return;
    }

    if (message.type === "audio.chunk") {
      broadcast(sessionId, {
        type: "session.info",
        sessionId,
        role,
        message: "Audio chunk received (transcription pipeline pending)."
      });
      return;
    }

    if (message.type === "transcript.partial" || message.type === "transcript.final") {
      const entry = {
        id: nanoid(10),
        startTimeMs: message.startTimeMs ?? Date.now(),
        endTimeMs: message.endTimeMs ?? Date.now(),
        text: message.text ?? "",
        isFinal: message.type === "transcript.final",
        confidence: message.confidence ?? null
      };
      sessions.get(sessionId).transcript.push(entry);
      broadcast(sessionId, { type: message.type, sessionId, ...entry });
      return;
    }

    if (message.type === "session.ping") {
      ws.send(JSON.stringify({ type: "session.pong", sessionId, timestamp: Date.now() }));
      return;
    }

    ws.send(
      JSON.stringify({
        type: "session.error",
        code: "unknown_type",
        message: `Unsupported event: ${message.type}`
      })
    );
  });

  ws.on("close", () => {
    clients.delete(ws);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});
