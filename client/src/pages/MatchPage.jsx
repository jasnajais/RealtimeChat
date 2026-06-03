import { useCallback, useEffect, useState } from 'react';
import { Shield, ArrowLeft, RefreshCw, Shuffle } from 'lucide-react';
import SoundManager from '../components/SoundManager';

const API_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000';

const RANDOM_SCANNER_PHASES = [
  'Scanning for anyone online...',
  'Pairing with the next available stranger...',
  'Finding a live random connection...',
  'Almost connected...',
  'Handshake in progress...'
];

function MatchPage({
  socket,
  username,
  setUsername,
  onMatched,
  onViewChange
}) {
  const [isSearching, setIsSearching] = useState(false);
  const [scanPhase, setScanPhase] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRandomizeName = () => {
    SoundManager.playClick();
    const adjs = ['Neon', 'Toxic', 'Silent', 'Cyber', 'Retro', 'Mystic', 'Cosmic', 'Solar', 'Sleepy', 'Golden'];
    const nouns = ['Ghost', 'Potato', 'Fox', 'Samurai', 'Koala', 'Dragon', 'Phoenix', 'Knight', 'Wizard', 'Hacker'];
    const rAdj = adjs[Math.floor(Math.random() * adjs.length)];
    const rNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const rNum = Math.floor(100 + Math.random() * 900);
    setUsername(`${rAdj}${rNoun}${rNum}`);
  };

  const generateRandomUsername = useCallback(() => {
    const adjs = ['Neon', 'Toxic', 'Silent', 'Cyber', 'Retro', 'Mystic', 'Cosmic', 'Solar', 'Sleepy', 'Golden'];
    const nouns = ['Ghost', 'Potato', 'Fox', 'Samurai', 'Koala', 'Dragon', 'Phoenix', 'Knight', 'Wizard', 'Hacker'];
    const rAdj = adjs[Math.floor(Math.random() * adjs.length)];
    const rNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const rNum = Math.floor(100 + Math.random() * 900);
    return `${rAdj}${rNoun}${rNum}`;
  }, []);

  const enterQueue = useCallback((registeredUsername) => {
    if (!socket) {
      setErrorMessage('Not connected to the server. Check that the backend is running.');
      setIsSearching(false);
      return;
    }

    const joinQueue = () => {
      socket.emit('register-socket', { username: registeredUsername });
      socket.emit('join-random-chat', { username: registeredUsername });
    };

    if (!socket.connected) {
      socket.connect();
      socket.once('connect', joinQueue);
      return;
    }

    joinQueue();
  }, [socket]);

  const startSearch = useCallback(() => {
    const trimmed = username.trim();
    const chosenUsername = trimmed || generateRandomUsername();
    setUsername(chosenUsername);

    SoundManager.playClick();
    setIsSearching(true);
    setErrorMessage('');

    fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: chosenUsername })
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || 'Failed to register username.');
        }
        return data;
      })
      .then((data) => {
        localStorage.setItem('neon_jwt_token', data.token);
        localStorage.setItem('neon_username', data.username);
        localStorage.setItem('neon_role', data.role || 'user');
        setUsername(data.username);
        enterQueue(data.username);
      })
      .catch((err) => {
        console.error(err);
        setErrorMessage(err.message);
        setIsSearching(false);
      });
  }, [username, generateRandomUsername, setUsername, enterQueue]);

  const handleStartSearch = (e) => {
    e.preventDefault();
    startSearch();
  };

  const handleCancelSearch = () => {
    SoundManager.playClick();
    setIsSearching(false);
    if (socket) {
      socket.emit('leave-match-queue', { username });
    }
    onViewChange('landing');
  };

  useEffect(() => {
    if (!socket) return;

    const handleMatched = (matchDetails) => {
      SoundManager.playMatch();
      onMatched(matchDetails);
    };

    const handleQueueTimeout = (data) => {
      setErrorMessage(data?.message || 'Your search timed out because of inactivity.');
      setIsSearching(false);
    };

    socket.on('matched', handleMatched);
    socket.on('queue-timeout', handleQueueTimeout);

    return () => {
      socket.off('matched', handleMatched);
      socket.off('queue-timeout', handleQueueTimeout);
    };
  }, [socket, onMatched]);

  useEffect(() => {
    if (!isSearching) return;
    const interval = setInterval(() => {
      setScanPhase((prev) => prev + 1);
    }, 2800);
    return () => clearInterval(interval);
  }, [isSearching]);

  if (isSearching) {
    return (
      <div className="min-h-dvh bg-[#07070c] flex flex-col items-center justify-center p-4 sm:p-6 relative select-none">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="w-52 h-52 sm:w-64 sm:h-64 border border-purple-500/30 rounded-full flex items-center justify-center relative p-6 sm:p-8 shadow-[0_0_50px_rgba(188,52,250,0.1)] mb-8 sm:mb-10 overflow-hidden">
          <div className="absolute inset-4 border border-purple-500/15 rounded-full" />
          <div className="absolute inset-12 border border-purple-500/10 rounded-full" />
          <div className="absolute inset-20 border border-purple-500/5 rounded-full" />
          <div className="absolute inset-0 radar-sweep border-r-2 border-purple-500/40 bg-gradient-to-l from-purple-500/10 to-transparent origin-center rounded-full pointer-events-none" />
          <div className="absolute inset-0 border-2 border-purple-500/25 rounded-full sonar-pulse pointer-events-none" />
          <div className="absolute inset-0 border-2 border-purple-500/15 rounded-full sonar-pulse [animation-delay:0.8s] pointer-events-none" />

          <div className="relative z-10 bg-slate-900 border border-purple-500/40 rounded-full p-6 shadow-2xl flex items-center justify-center">
            <RefreshCw size={36} className="text-[#bc34fa] animate-spin [animation-duration:3s]" />
          </div>
        </div>

        <div className="text-center max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white font-orbitron uppercase tracking-wider">
              Random Pairing
            </h2>
            <p className="text-xs font-mono animate-pulse text-[#00f2fe]">
              {RANDOM_SCANNER_PHASES[scanPhase % RANDOM_SCANNER_PHASES.length]}
            </p>
          </div>

          <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
            Matching with anyone in the queue
          </p>

          <button
            onClick={handleCancelSearch}
            className="w-full py-3.5 px-6 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-600/10 text-rose-400 font-bold uppercase tracking-widest text-xs font-orbitron rounded-xl active:scale-[0.98] transition-all"
          >
            Cancel Signal Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell bg-[#07070c] relative flex flex-col gap-6 sm:gap-8 select-none">
      <div className="absolute top-[20%] left-[10%] w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-[#00f2fe]/5 rounded-full blur-3xl pointer-events-none" />

      <header className="max-w-4xl w-full mx-auto flex items-center gap-4 z-10">
        <button
          onClick={() => { SoundManager.playClick(); onViewChange('landing'); }}
          className="p-2.5 bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-lg font-black text-white font-orbitron uppercase tracking-wide">
            Random Chat
          </h1>
          <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
            Anyone Online
          </p>
        </div>
      </header>

      <main className="max-w-2xl w-full mx-auto bg-slate-900/40 backdrop-blur-xl border border-slate-850/80 rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl my-2 sm:my-6 z-10">
        <form onSubmit={handleStartSearch} className="space-y-8">
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
              {errorMessage}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest font-orbitron text-slate-400">Choose Username</label>
              <button
                type="button"
                onClick={handleRandomizeName}
                className="text-[10px] font-bold uppercase tracking-widest text-[#bc34fa] hover:text-[#ff007f] flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={10} className="animate-spin [animation-duration:10s]" />
                Generate Temp Name
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-850 rounded-2xl pl-4 pr-12 py-4 text-white text-base font-semibold focus:outline-none focus:border-[#bc34fa] focus:ring-2 focus:ring-[#bc34fa]/10 transition-all placeholder-slate-700"
                placeholder="e.g. NeonGhost492"
                maxLength={25}
                autoComplete="off"
              />
              <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-600 font-mono text-[10px] tracking-widest">
                {username.length}/25
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-slate-600 font-mono">
              Leave it blank and we will generate a temporary name for you.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-4.5 rounded-2xl text-white font-bold tracking-widest font-orbitron uppercase text-sm shadow-[0_0_20px_rgba(188,52,250,0.2)] hover:shadow-[0_0_30px_rgba(188,52,250,0.4)] active:scale-[0.98] transition-all bg-gradient-to-r from-[#00f2fe] to-[#bc34fa]"
          >
            <Shuffle size={16} className="inline -mt-0.5 mr-2" />
            Start Random Chat
          </button>
        </form>
      </main>

      <footer className="max-w-2xl w-full mx-auto flex items-center justify-center gap-2 text-slate-600 text-[10px] font-mono tracking-wide z-10">
        <Shield size={12} className="text-[#ff007f]" />
        ANONYMOUS CENSORSHIP FILTERS ARE ENGAGED. BE RESPECTFUL.
      </footer>
    </div>
  );
}

export default MatchPage;
