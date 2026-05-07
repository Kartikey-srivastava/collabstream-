import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import SimplePeer from "simple-peer";
import VideoFeed from "./VideoFeed";
import YoutubePlayer from "./YoutubePlayer";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:4000";

export default function Room({ userName }) {
  const { roomID } = useParams();
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // socketId -> SimplePeer instance
  const [peers, setPeers] = useState([]); // [{ socketId, name, stream }]
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [ytState, setYtState] = useState({ url: "", playing: false, time: 0 });
  const [copied, setCopied] = useState(false);
  const screenStreamRef = useRef(null);

  // ── Helper: update peers state from ref ──────────────────────────────────
  const syncPeersState = useCallback(() => {
    setPeers(
      Object.entries(peersRef.current).map(([socketId, { name, stream }]) => ({
        socketId,
        name,
        stream,
      }))
    );
  }, []);

  // ── Create a peer (initiator or receiver) ────────────────────────────────
  const createPeer = useCallback(
    (targetId, targetName, initiator) => {
      const peer = new SimplePeer({
        initiator,
        trickle: true,
        stream: localStreamRef.current,
      });

      peer.on("signal", (signal) => {
        socketRef.current.emit("signal", { to: targetId, signal });
      });

      peer.on("stream", (remoteStream) => {
        peersRef.current[targetId] = {
          ...peersRef.current[targetId],
          stream: remoteStream,
        };
        syncPeersState();
      });

      peer.on("error", (err) => console.warn("Peer error:", err));

      peer.on("close", () => {
        delete peersRef.current[targetId];
        syncPeersState();
      });

      peersRef.current[targetId] = { name: targetName, stream: null, peer };
      syncPeersState();
      return peer;
    },
    [syncPeersState]
  );

  // ── Main setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1. Get local media
      const stream = await navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .catch(() => new MediaStream()); // fallback to empty stream

      if (cancelled) return;
      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Connect to signaling server
      socketRef.current = io(SERVER_URL);
      const socket = socketRef.current;

      socket.emit("join-room", { roomID, userName });

      // 3. Server sends existing peers
      socket.on("room-joined", ({ peers: existingPeers, ytState: yt }) => {
        setYtState(yt);
        existingPeers.forEach(({ socketId, name }) => {
          createPeer(socketId, name, true);
        });
      });

      // 4. New user joined — they are the receiver
      socket.on("user-joined", ({ socketId, name }) => {
        createPeer(socketId, name, false);
      });

      // 5. Incoming WebRTC signal
      socket.on("signal", ({ from, signal }) => {
        if (peersRef.current[from]) {
          peersRef.current[from].peer.signal(signal);
        }
      });

      // 6. User left
      socket.on("user-left", ({ socketId }) => {
        if (peersRef.current[socketId]) {
          peersRef.current[socketId].peer.destroy();
          delete peersRef.current[socketId];
          syncPeersState();
        }
      });

      // 7. YouTube sync from others
      socket.on("yt-sync", ({ action, time, url }) => {
        setYtState((prev) => ({
          ...prev,
          url: action === "load" ? url : prev.url,
          playing: action === "play" ? true : action === "pause" ? false : prev.playing,
          time: time !== undefined ? time : prev.time,
        }));
      });
    })();

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      Object.values(peersRef.current).forEach(({ peer }) => peer?.destroy());
      peersRef.current = {};
      socketRef.current?.disconnect();
    };
  }, [roomID, userName, createPeer, syncPeersState]);

  // ── Controls ─────────────────────────────────────────────────────────────
  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace video track in all peers
        Object.values(peersRef.current).forEach(({ peer }) => {
          const sender = peer._pc?.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        });

        // Update local preview
        const newStream = new MediaStream([
          screenTrack,
          ...localStreamRef.current.getAudioTracks(),
        ]);
        localStreamRef.current = newStream;
        setLocalStream(newStream);
        setIsScreenSharing(true);

        screenTrack.onended = () => stopScreenShare();
      } catch (err) {
        console.warn("Screen share cancelled:", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((camStream) => {
        const camTrack = camStream.getVideoTracks()[0];
        Object.values(peersRef.current).forEach(({ peer }) => {
          const sender = peer._pc?.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(camTrack);
        });
        localStreamRef.current = camStream;
        setLocalStream(camStream);
        setIsScreenSharing(false);
      })
      .catch(console.warn);
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── YouTube sync emitter ─────────────────────────────────────────────────
  const emitYtSync = useCallback(
    (action, time, url) => {
      socketRef.current?.emit("yt-sync", { roomID, action, time, url });
      setYtState((prev) => ({
        ...prev,
        url: action === "load" ? url : prev.url,
        playing: action === "play" ? true : action === "pause" ? false : prev.playing,
        time: time !== undefined ? time : prev.time,
      }));
    },
    [roomID]
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-indigo-400">CollabStream</span>
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded font-mono">
            {roomID}
          </span>
        </div>
        <button
          onClick={copyInviteLink}
          className="flex items-center gap-2 text-sm bg-indigo-600 hover:bg-indigo-500 transition px-4 py-2 rounded-lg font-medium"
        >
          {copied ? "✅ Copied!" : "🔗 Copy Invite Link"}
        </button>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* YouTube / Main Area */}
        <div className="flex-1 flex flex-col p-4 gap-4">
          <YoutubePlayer ytState={ytState} onSync={emitYtSync} />
        </div>

        {/* Sidebar: Participant Videos */}
        <aside className="w-64 bg-gray-900 border-l border-gray-800 p-3 flex flex-col gap-3 overflow-y-auto">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
            Participants ({peers.length + 1})
          </p>
          {/* Local */}
          <VideoFeed stream={localStream} name={`${userName} (You)`} muted />
          {/* Remote */}
          {peers.map((p) => (
            <VideoFeed key={p.socketId} stream={p.stream} name={p.name} />
          ))}
        </aside>
      </div>

      {/* Control Bar */}
      <footer className="flex items-center justify-center gap-4 py-4 bg-gray-900 border-t border-gray-800">
        <ControlBtn
          onClick={toggleMute}
          active={isMuted}
          activeLabel="🔇 Unmute"
          inactiveLabel="🎙️ Mute"
        />
        <ControlBtn
          onClick={toggleVideo}
          active={isVideoOff}
          activeLabel="📵 Start Video"
          inactiveLabel="📷 Stop Video"
        />
        <ControlBtn
          onClick={toggleScreenShare}
          active={isScreenSharing}
          activeLabel="🛑 Stop Share"
          inactiveLabel="🖥️ Share Screen"
          accent
        />
      </footer>
    </div>
  );
}

function ControlBtn({ onClick, active, activeLabel, inactiveLabel, accent }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-full text-sm font-semibold transition
        ${
          active
            ? "bg-red-600 hover:bg-red-500 text-white"
            : accent
            ? "bg-indigo-600 hover:bg-indigo-500 text-white"
            : "bg-gray-700 hover:bg-gray-600 text-white"
        }`}
    >
      {active ? activeLabel : inactiveLabel}
    </button>
  );
}
