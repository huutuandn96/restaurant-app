import http from "node:http";
import { Server } from "socket.io";
import Redis from "ioredis";
import jwt from "jsonwebtoken";

const PORT = Number(process.env.SOCKET_PORT || 4000);
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379/0";
const SECRET = process.env.SOCKET_JWT_SECRET || "change_me_too";
const CHANNEL = "restaurant:events";

const httpServer = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", clients: io.engine.clientsCount }));
  }
  res.writeHead(404).end();
});

const io = new Server(httpServer, { cors: { origin: "*" } });

// Rooms theo SPEC §1:
//   staff JWT  -> role waiter/kitchen/manager/owner
//   khách      -> session JWT do Rails ký (table_session_id)
const ROLE_ROOMS = {
  waiter: ["waiters"],
  kitchen: ["kitchen"],
  manager: ["waiters", "kitchen", "managers"],
  owner: ["waiters", "kitchen", "managers"],
};

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("unauthorized"));
  try {
    socket.data.claims = jwt.verify(token, SECRET);
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  const { kind, role, table_session_id: sessionId } = socket.data.claims;
  const rooms = kind === "guest" ? [`table_session:${sessionId}`] : ROLE_ROOMS[role] || [];
  rooms.forEach((r) => socket.join(r));
  console.log(`[socket] connect ${socket.id} kind=${kind} rooms=${rooms.join(",")}`);
  socket.on("disconnect", () => console.log(`[socket] disconnect ${socket.id}`));
});

const sub = new Redis(REDIS_URL);
sub.subscribe(CHANNEL, (err) => {
  if (err) console.error("[redis] subscribe failed", err);
  else console.log(`[redis] subscribed ${CHANNEL}`);
});
sub.on("message", (_channel, raw) => {
  try {
    const { rooms = [], event, payload } = JSON.parse(raw);
    // io.to(array) gộp room nên socket nằm ở nhiều room chỉ nhận 1 lần
    if (rooms.length) io.to(rooms).emit(event, payload);
  } catch (e) {
    console.error("[redis] bad message", e.message);
  }
});

httpServer.listen(PORT, () => console.log(`[socket] listening on :${PORT}`));
