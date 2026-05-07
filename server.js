const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// roomID -> { users: Map<socketId, { name, socketId }>, ytState: {...} }
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // ── Join Room ──────────────────────────────────────────────────────────────
  socket.on("join-room", ({ roomID, userName }) => {
    socket.join(roomID);

    if (!rooms.has(roomID)) {
      rooms.set(roomID, {
        users: new Map(),
        ytState: { url: "", playing: false, time: 0, updatedAt: Date.now() },
      });
    }

    const room = rooms.get(roomID);
    room.users.set(socket.id, { name: userName, socketId: socket.id });

    // Send existing peers list to the new user
    const existingPeers = [...room.users.values()].filter(
      (u) => u.socketId !== socket.id
    );
    socket.emit("room-joined", {
      peers: existingPeers,
      ytState: room.ytState,
    });

    // Notify others of the new user
    socket.to(roomID).emit("user-joined", {
      socketId: socket.id,
      name: userName,
    });

    socket.data.roomID = roomID;
    socket.data.userName = userName;
    console.log(`${userName} joined room ${roomID}`);
  });

  // ── WebRTC Signaling ───────────────────────────────────────────────────────
  socket.on("signal", ({ to, signal }) => {
    io.to(to).emit("signal", { from: socket.id, signal });
  });

  // ── YouTube Sync ───────────────────────────────────────────────────────────
  socket.on("yt-sync", ({ roomID, action, time, url }) => {
    const room = rooms.get(roomID);
    if (!room) return;

    if (action === "load") room.ytState.url = url;
    if (action === "play") room.ytState.playing = true;
    if (action === "pause") room.ytState.playing = false;
    if (time !== undefined) room.ytState.time = time;
    room.ytState.updatedAt = Date.now();

    // Broadcast to everyone else in the room
    socket.to(roomID).emit("yt-sync", { action, time, url });
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const { roomID, userName } = socket.data;
    if (!roomID) return;

    const room = rooms.get(roomID);
    if (room) {
      room.users.delete(socket.id);
      if (room.users.size === 0) rooms.delete(roomID);
    }

    socket.to(roomID).emit("user-left", { socketId: socket.id, name: userName });
    console.log(`${userName} left room ${roomID}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`CollabStream server running on :${PORT}`));
