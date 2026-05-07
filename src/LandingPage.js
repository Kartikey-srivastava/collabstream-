import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

export default function LandingPage({ onSetName, redirectToRoom }) {
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const params = useParams();

  const handleJoin = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSetName(name.trim());
    const roomID = params.roomID || uuidv4().slice(0, 8);
    navigate(`/room/${roomID}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-indigo-400 tracking-tight">CollabStream</h1>
          <p className="text-gray-400 text-sm mt-2">No login. Just vibe together.</p>
        </div>

        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name…"
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition text-sm"
          >
            {redirectToRoom ? "Join Room →" : "Create New Room →"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600 mt-6">
          Share the room link with friends to invite them instantly.
        </p>
      </div>
    </div>
  );
}
