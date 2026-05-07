import React, { useEffect, useRef } from "react";

export default function VideoFeed({ stream, name, muted = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-gray-800 aspect-video">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold">
            {name?.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      {/* Name tag */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 backdrop-blur-sm">
        <p className="text-xs text-white truncate font-medium">{name}</p>
      </div>
    </div>
  );
}
