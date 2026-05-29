import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Dice5, Hash, Send, Users, Crown, RefreshCw, Sparkles } from 'lucide-react';
import SoundManager from '../components/SoundManager';

function MultiplayerRoomPage({ socket, username, onViewChange }) {
  const [roomCode, setRoomCode] = useState('');
  const [joinedRoom, setJoinedRoom] = useState('');
  const [players, setPlayers] = useState([]);
  const [host, setHost] = useState('');
  const [roomMessages, setRoomMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [spinResult, setSpinResult] = useState('');
  const [isJoined, setIsJoined] = useState(false);

  const [generatedRoomCode] = useState(() => Math.random().toString(36).slice(2, 6).toUpperCase());

  const joinLobby = useCallback((code) => {
    const cleanCode = (code || roomCode).trim().toUpperCase();
    if (!socket || !cleanCode || !username) return;
    SoundManager.playClick();
    setJoinedRoom(cleanCode);
    socket.emit('join-multiplayer-lobby', { username, roomCode: cleanCode });
    setIsJoined(true);
  }, [socket, username, roomCode]);

  const leaveLobby = useCallback(() => {
    SoundManager.playClick();
    setIsJoined(false);
    setPlayers([]);
    setHost('');
    setSpinResult('');
    setRoomMessages((prev) => [...prev, { sender: 'SYSTEM', message: 'Left the lobby.' }]);
  }, []);

  const sendLobbyMessage = (e) => {
    e.preventDefault();
    if (!socket || !joinedRoom || !message.trim()) return;
    SoundManager.playClick();
    socket.emit('multiplayer-message', { roomCode: joinedRoom, message: message.trim() });
    setMessage('');
  };

  const spinWheel = () => {
    if (!socket || !joinedRoom) return;
    SoundManager.playClick();
    socket.emit('spin-the-wheel', { roomCode: joinedRoom });
  };

  useEffect(() => {
    if (!socket) return;

    const handlePlayerList = (data = {}) => {
      setPlayers(Array.isArray(data.players) ? data.players : []);
      setHost(data.host || '');
    };

    const handleMessage = (payload = {}) => {
      setRoomMessages((prev) => [...prev, payload]);
    };

    const handleSpin = (payload = {}) => {
      setSpinResult(payload.selectedUsername ? `Wheel landed on ${payload.selectedUsername}` : 'Wheel spun.');
    };

    socket.on('multiplayer-player-list', handlePlayerList);
    socket.on('multiplayer-message', handleMessage);
    socket.on('wheel-spinning', handleSpin);

    return () => {
      socket.off('multiplayer-player-list', handlePlayerList);
      socket.off('multiplayer-message', handleMessage);
      socket.off('wheel-spinning', handleSpin);
    };
  }, [socket]);

  return (
    <div className="page-shell bg-[#07070c] text-slate-200">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => { SoundManager.playClick(); onViewChange('landing'); }}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-white"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Hash size={14} className="text-[#00f2fe]" />
            Multiplayer Room
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <Users size={14} className="text-[#bc34fa]" />
              Room Setup
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder={generatedRoomCode}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#bc34fa]"
              />
              <button
                type="button"
                onClick={() => joinLobby(roomCode || generatedRoomCode)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#bc34fa] to-[#ff007f] px-4 py-3 text-xs font-black uppercase tracking-widest text-white"
              >
                <Send size={14} />
                Join Room
              </button>
              <button
                type="button"
                onClick={leaveLobby}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-300"
              >
                <Dice5 size={14} />
                Reset Lobby View
              </button>
              <button
                type="button"
                onClick={() => setRoomCode(generatedRoomCode)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-300"
              >
                <RefreshCw size={14} />
                Use Generated Code
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <Crown size={12} className="text-amber-300" />
                Host
              </div>
              <p className="mt-2 text-sm text-white">{host || 'No host yet'}</p>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <Sparkles size={12} className="text-[#00f2fe]" />
                Current Spin
              </div>
              <p className="mt-2 text-sm text-white">{spinResult || 'Spin the wheel once the lobby has players.'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-white">Group room</h1>
                  <p className="mt-1 text-sm text-slate-400">Create a small room, chat, and spin the wheel together.</p>
                </div>
                <button
                  type="button"
                  onClick={spinWheel}
                  disabled={!isJoined}
                  className="w-full sm:w-auto rounded-xl border border-[#00f2fe]/20 bg-[#00f2fe]/5 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#00f2fe] disabled:opacity-30"
                >
                  Dice Spin
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Players</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {players.length > 0 ? players.map((player) => (
                      <span key={player} className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                        {player}
                      </span>
                    )) : (
                      <span className="text-sm text-slate-500">No one is in the room yet.</span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Room Code</div>
                  <div className="mt-2 text-3xl font-black tracking-[0.2em] text-white">{joinedRoom || '----'}</div>
                  <p className="mt-2 text-xs text-slate-500">Share this code with friends to join the same lobby.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Lobby chat
              </div>
              <div className="max-h-[420px] overflow-y-auto p-5 space-y-3">
                {roomMessages.length > 0 ? roomMessages.map((item, index) => (
                  <div key={`${item.timestamp || index}`} className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{item.sender || 'SYSTEM'}</div>
                    <p className="mt-1 text-sm text-slate-200">{item.message}</p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No lobby messages yet.</p>
                )}
              </div>
              <form onSubmit={sendLobbyMessage} className="flex gap-2 border-t border-slate-800 p-4">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={!isJoined}
                  placeholder={isJoined ? 'Say something to the room...' : 'Join the room to chat'}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#bc34fa] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!isJoined || !message.trim()}
                  className="rounded-xl bg-gradient-to-r from-[#bc34fa] to-[#ff007f] px-4 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-30"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default MultiplayerRoomPage;
