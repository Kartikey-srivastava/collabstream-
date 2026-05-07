# 🎬 CollabStream — No-Login Video Calling & Watch Party

A peer-to-peer video calling + YouTube sync MVP. No accounts, no database. Just share a link.

---

## 🗂️ Project Structure

```
collabstream/
├── server.js              ← Node.js signaling server (Socket.io)
├── package.json           ← Backend deps
└── client/
    ├── package.json       ← Frontend deps
    └── src/
        ├── App.js          ← Router + name state
        ├── LandingPage.js  ← Name entry / room creation
        ├── Room.js         ← WebRTC + Socket.io logic
        ├── VideoFeed.js    ← Individual video tile
        └── YoutubePlayer.js← YT IFrame API + sync
```

---

## 🚀 Quick Start

### 1. Backend

```bash
cd collabstream
npm install
npm run dev        # nodemon server.js on :4000
```

### 2. Frontend

```bash
cd collabstream/client
npm install
npm start          # CRA dev server on :3000
```

Open http://localhost:3000, enter a name, share the room URL with a friend.

---

## ✨ Features

| Feature | How |
|---|---|
| No login | Name entered locally, stored in sessionStorage |
| Video calling | WebRTC via `simple-peer`, signaling over Socket.io |
| YouTube sync | YT IFrame API + Socket.io broadcasts play/pause/seek |
| Screen sharing | `getDisplayMedia`, replaces video track in all peers |
| Invite link | Copies current URL to clipboard |
| Dark mode UI | Tailwind CSS |

---

## 🌐 Deployment Notes

- Set `REACT_APP_SERVER_URL` env var to your deployed backend URL
- Works great on **Railway** (backend) + **Vercel** (frontend)
- For production WebRTC, add a TURN server (e.g. Twilio's free TURN)

---

## 🔧 TURN Server (Production)

Add to SimplePeer config in `Room.js`:
```js
config: {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:your-turn-server.com",
      username: "user",
      credential: "pass"
    }
  ]
}
```
