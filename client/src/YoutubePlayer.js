import React, { useEffect, useRef, useState } from "react";

/* Loads YouTube IFrame API once globally */
function loadYTScript() {
  if (window.YT) return Promise.resolve();
  return new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = resolve;
  });
}

function extractVideoId(urlOrId) {
  if (!urlOrId) return null;
  // Already a plain ID?
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
  try {
    const u = new URL(urlOrId);
    return u.searchParams.get("v") || u.pathname.split("/").pop() || null;
  } catch {
    return null;
  }
}

export default function YoutubePlayer({ ytState, onSync }) {
  const playerRef = useRef(null);
  const playerElRef = useRef(null);
  const ignoreEventRef = useRef(false); // prevent echo
  const [inputUrl, setInputUrl] = useState("");
  const [videoId, setVideoId] = useState(null);

  // ── Create or re-create player when videoId changes ──────────────────────
  useEffect(() => {
    if (!videoId) return;

    loadYTScript().then(() => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      playerRef.current = new window.YT.Player(playerElRef.current, {
        videoId,
        playerVars: { controls: 1, rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e) => {
            if (ignoreEventRef.current) return;
            const t = playerRef.current.getCurrentTime();
            if (e.data === window.YT.PlayerState.PLAYING) onSync("play", t);
            if (e.data === window.YT.PlayerState.PAUSED) onSync("pause", t);
          },
        },
      });
    });

    return () => {
      playerRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // ── React to incoming sync events ────────────────────────────────────────
  useEffect(() => {
    const player = playerRef.current;
    if (!player || typeof player.seekTo !== "function") return;

    ignoreEventRef.current = true;
    if (ytState.playing) {
      player.seekTo(ytState.time, true);
      player.playVideo();
    } else {
      player.seekTo(ytState.time, true);
      player.pauseVideo();
    }
    setTimeout(() => (ignoreEventRef.current = false), 300);
  }, [ytState]);

  // ── Load new URL from remote ─────────────────────────────────────────────
  useEffect(() => {
    if (ytState.url) {
      const id = extractVideoId(ytState.url);
      if (id && id !== videoId) setVideoId(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytState.url]);

  const handleLoad = () => {
    const id = extractVideoId(inputUrl);
    if (!id) return alert("Invalid YouTube URL or ID");
    setVideoId(id);
    onSync("load", 0, inputUrl);
    setInputUrl("");
  };

  return (
    <div className="flex flex-col gap-4 flex-1">
      {/* URL input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLoad()}
          placeholder="Paste a YouTube URL and press Enter…"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleLoad}
          className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition"
        >
          ▶ Load
        </button>
      </div>

      {/* Player */}
      <div className="flex-1 bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center min-h-[300px] relative">
        {videoId ? (
          <div ref={playerElRef} className="w-full h-full min-h-[300px]" />
        ) : (
          <div className="text-center text-gray-600">
            <div className="text-5xl mb-3">🎬</div>
            <p className="text-sm">Paste a YouTube link above to start watching together</p>
          </div>
        )}
      </div>
    </div>
  );
}
