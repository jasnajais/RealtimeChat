import { useEffect, useState } from 'react';

// Simple neon styled form for matchmaking
export default function MatchingForm({ socket, onMatched }) {
  const [username, setUsername] = useState('');
  const [interests, setInterests] = useState([]);
  const [mood, setMood] = useState('chill');

  const availableInterests = ['gaming', 'anime', 'music', 'coding', 'football'];
  const moods = ['bored', 'lonely', 'excited', 'stressed', 'chill'];

  const toggleInterest = (interest) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!socket) return;

    // Register socket username (empty string will let server generate temporary)
    if (username.trim()) {
      socket.emit('register-socket', { username: username.trim() });
    }
    // Join matchmaking queue
    socket.emit('join-match-queue', {
      username: username.trim() || undefined,
      interests,
      mood,
    });
  };

  // Listen for match event
  useEffect(() => {
    if (!socket) return undefined;

    const handler = (data) => {
      // data includes strangerName, roomId, commonInterests, strangerMood, initiator
      onMatched(data);
    };
    socket.on('matched', handler);
    return () => socket.off('matched', handler);
  }, [socket, onMatched]);

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-lg space-y-4">
      <h2 className="text-xl font-bold text-center text-white">Find a Stranger</h2>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">Temporary Username (optional)</label>
        <input
          type="text"
          placeholder="Leave empty for random name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-slate-800/50 text-white border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <span className="block text-xs font-semibold text-slate-400 mb-1">Interests</span>
        <div className="flex flex-wrap gap-2">
          {availableInterests.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleInterest(i)}
              className={`px-3 py-1 rounded-full text-xs transition-all ${interests.includes(i) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="block text-xs font-semibold text-slate-400 mb-1">Mood</span>
        <div className="flex flex-wrap gap-2">
          {moods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMood(m)}
              className={`px-3 py-1 rounded-full text-xs transition-all ${mood === m ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="w-full flex justify-center items-center gap-2 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors"
      >
        Find Match
      </button>
    </form>
  );
}
