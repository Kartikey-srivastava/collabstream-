const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path"); // Static files ke liye zaroori hai

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Room and State Management
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

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

    const existingPeers = [...room.users.values()].filter(u => u.socketId !== socket.id);
    socket.emit("room-joined", { peers: existingPeers, ytState: room.ytState });
    socket.to(roomID).emit("user-joined", { socketId: socket.id, name: userName });
    
    socket.data.roomID = roomID;
    socket.data.userName = userName;
  });

  socket.on("signal", ({ to, signal }) => {
    io.to(to).emit("signal", { from: socket.id, signal });
  });

  socket.on("yt-sync", ({ roomID, action, time, url }) => {
    const room = rooms.get(roomID);
    if (!room) return;
    if (action === "load") room.ytState.url = url;
    if (action === "play") room.ytState.playing = true;
    if (action === "pause") room.ytState.playing = false;
    if (time !== undefined) room.ytState.time = time;
    socket.to(roomID).emit("yt-sync", { action, time, url });
  });

  socket.on("disconnect", () => {
    const { roomID, userName } = socket.data;
    if (!roomID) return;
    const room = rooms.get(roomID);
    if (room) {
      room.users.delete(socket.id);
      if (room.users.size === 0) rooms.delete(roomID);
    }
    socket.to(roomID).emit("user-left", { socketId: socket.id, name: userName });
  });
});

// --- PRODUCTION DEPLOYMENT SETTINGS ---
// 1. React build folder ko serve karo
app.use(express.static(path.join(__dirname, "client/build")));

// 2. Kisi bhi route par React ki index.html bhej do (SPA support)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client/build", "index.html"));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
