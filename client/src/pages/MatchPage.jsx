import { useCallback, useEffect, useRef, useState } from 'react';
import { Shield, Hash, ArrowLeft, RefreshCw, Shuffle } from 'lucide-react';
import SoundManager from '../components/SoundManager';

const API_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000';

const INTERESTS_LIST = ['gaming', 'anime', 'music', 'coding', 'football', 'movies', 'crypto', 'fashion', 'memes', 'art'];

const MOODS_LIST = [
  { id: 'bored', emoji: '🥱', label: 'Bored' },
  { id: 'lonely', emoji: '🥺', label: 'Lonely' },
  { id: 'excited', emoji: '🤩', label: 'Excited' },
  { id: 'stressed', emoji: '🤯', label: 'Stressed' },
  { id: 'chill', emoji: '😎', label: 'Chill' }
];

const SCANNER_PHASES = [
  "Connecting to secure chat waves...",
  "Calibrating interest vectors...",
  "Searching queue for compatible minds...",
  "Filtering toxic signatures...",
  "Stranger match frequency detected...",
  "Establishing secure room handshake..."
];

const RANDOM_SCANNER_PHASES = [
  "Scanning for anyone online...",
  "Pairing with the next available stranger...",
  "No filters — pure random match...",
  "Someone nearby in the queue...",
  "Almost connected..."
];

function MatchPage({
  socket,
  username,
  setUsername,
  onMatched,
  onViewChange,
  reconnectTarget = '',
  matchMode = 'smart',
  onMatchModeChange,
  autoStartRandom = false,
  onAutoStartConsumed
}) {
  const isRandomMode = matchMode === 'random';
  const autoStartHandledRef = useRef(false);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedMood, setSelectedMood] = useState('chill');
  const [isSearching, setIsSearching] = useState(false);
  const [scanPhase, setScanPhase] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Generate a random temporary username
  const handleRandomizeName = () => {
    SoundManager.playClick();
    const adjs = ['Neon', 'Toxic', 'Silent', 'Cyber', 'Retro', 'Mystic', 'Cosmic', 'Solar', 'Sleepy', 'Golden'];
    const nouns = ['Ghost', 'Potato', 'Fox', 'Samurai', 'Koala', 'Dragon', 'Phoenix', 'Knight', 'Wizard', 'Hacker'];
    const rAdj = adjs[Math.floor(Math.random() * adjs.length)];
    const rNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const rNum = Math.floor(100 + Math.random() * 900);
    setUsername(`${rAdj}${rNoun}${rNum}`);
  };

  const handleInterestToggle = (interest) => {
    SoundManager.playClick();
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(prev => prev.filter(i => i !== interest));
    } else {
      setSelectedInterests(prev => [...prev, interest]);
    }
  };

  const handleSelectMood = (moodId) => {
    SoundManager.playClick();
    setSelectedMood(moodId);
  };

  const generateRandomUsername = useCallback(() => {
    const adjs = ['Neon', 'Toxic', 'Silent', 'Cyber', 'Retro', 'Mystic', 'Cosmic', 'Solar', 'Sleepy', 'Golden'];
    const nouns = ['Ghost', 'Potato', 'Fox', 'Samurai', 'Koala', 'Dragon', 'Phoenix', 'Knight', 'Wizard', 'Hacker'];
    const rAdj = adjs[Math.floor(Math.random() * adjs.length)];
    const rNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const rNum = Math.floor(100 + Math.random() * 900);
    return `${rAdj}${rNoun}${rNum}`;
  }, []);

  const enterQueue = useCallback((registeredUsername, useRandomMode) => {
    if (!socket) {
      setErrorMessage('Not connected to the server. Check that the backend is running.');
      setIsSearching(false);
      return;
    }

    const joinQueue = () => {
      socket.emit('register-socket', { username: registeredUsername });

      if (reconnectTarget) {
        socket.emit('reconnect-previous-stranger', {
          username: registeredUsername,
          targetUsername: reconnectTarget,
          interests: selectedInterests,
          mood: selectedMood
        });
        return;
      }

      if (useRandomMode) {
        socket.emit('join-random-chat', { username: registeredUsername });
      } else {
        socket.emit('join-match-queue', {
          username: registeredUsername,
          interests: selectedInterests,
          mood: selectedMood
        });
      }
    };

    if (!socket.connected) {
      socket.connect();
      socket.once('connect', joinQueue);
      return;
    }

    joinQueue();
  }, [socket, reconnectTarget, selectedInterests, selectedMood]);

  const startSearch = useCallback((useRandomMode = isRandomMode) => {
    const trimmed = username.trim();
    const chosenUsername = useRandomMode
      ? generateRandomUsername()
      : (trimmed || generateRandomUsername());
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
        enterQueue(data.username, useRandomMode);
      })
      .catch((err) => {
        console.error(err);
        setErrorMessage(err.message);
        setIsSearching(false);
      });
  }, [username, generateRandomUsername, setUsername, enterQueue, isRandomMode]);

  const handleStartSearch = (e) => {
    e.preventDefault();
    startSearch(isRandomMode);
  };

  useEffect(() => {
    if (!autoStartRandom || autoStartHandledRef.current) return;
    autoStartHandledRef.current = true;
    onAutoStartConsumed?.();
    startSearch(true);
  }, [autoStartRandom, onAutoStartConsumed, startSearch]);

  const handleCancelSearch = () => {
    SoundManager.playClick();
    setIsSearching(false);
    if (socket) {
      socket.emit('leave-match-queue', { username });
    }
  };

  // Matchmaking listener
  useEffect(() => {
    if (!socket) return;

    const handleMatched = (matchDetails) => {
      SoundManager.playMatch();
      onMatched(matchDetails); // { strangerName, roomId, commonInterests, strangerMood }
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

  // Sonar Scanner dynamic text cycling
  useEffect(() => {
    if (!isSearching) return;
    const interval = setInterval(() => {
      setScanPhase(prev => prev + 1);
    }, 2800);
    return () => clearInterval(interval);
  }, [isSearching]);

  const activeScannerPhases = isRandomMode ? RANDOM_SCANNER_PHASES : SCANNER_PHASES;

  if (isSearching) {
    return (
      <div className="min-h-dvh bg-[#07070c] flex flex-col items-center justify-center p-4 sm:p-6 relative select-none">
        {/* Background radar blur effects */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        
        {/* Sonar Radar Screen */}
        <div className="w-52 h-52 sm:w-64 sm:h-64 border border-purple-500/30 rounded-full flex items-center justify-center relative p-6 sm:p-8 shadow-[0_0_50px_rgba(188,52,250,0.1)] mb-8 sm:mb-10 overflow-hidden">
          
          {/* Sonar concentric circular grids */}
          <div className="absolute inset-4 border border-purple-500/15 rounded-full" />
          <div className="absolute inset-12 border border-purple-500/10 rounded-full" />
          <div className="absolute inset-20 border border-purple-500/5 rounded-full" />
          
          {/* Radar Scanner Sweep bar */}
          <div className="absolute inset-0 radar-sweep border-r-2 border-purple-500/40 bg-gradient-to-l from-purple-500/10 to-transparent origin-center rounded-full pointer-events-none" />
          
          {/* Pulsing Sonar expansion rings */}
          <div className="absolute inset-0 border-2 border-purple-500/25 rounded-full sonar-pulse pointer-events-none" />
          <div className="absolute inset-0 border-2 border-purple-500/15 rounded-full sonar-pulse [animation-delay:0.8s] pointer-events-none" />

          {/* Core Match Icon */}
          <div className="relative z-10 bg-slate-900 border border-purple-500/40 rounded-full p-6 shadow-2xl flex items-center justify-center">
            <RefreshCw size={36} className="text-[#bc34fa] animate-spin [animation-duration:3s]" />
          </div>
        </div>

        {/* Phase Text & Controls */}
        <div className="text-center max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white font-orbitron uppercase tracking-wider">
              {isRandomMode ? 'Random Pairing' : 'Matching Signal'}
            </h2>
            <p className={`text-xs font-mono animate-pulse ${isRandomMode ? 'text-[#00f2fe]' : 'text-[#bc34fa]'}`}>
              {activeScannerPhases[scanPhase % activeScannerPhases.length]}
            </p>
          </div>

          {!isRandomMode && (
            <div className="flex flex-col sm:flex-row justify-center gap-1 sm:gap-4 text-[10px] text-slate-500 font-mono tracking-widest uppercase">
              <span>Interests: {selectedInterests.length} selected</span>
              <span className="hidden sm:inline">•</span>
              <span>Mood: {selectedMood}</span>
            </div>
          )}
          {isRandomMode && (
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
              Matching with anyone in the queue
            </p>
          )}

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
      
      {/* Decorative background glow rings */}
      <div className="absolute top-[20%] left-[10%] w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-[#00f2fe]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <header className="max-w-4xl w-full mx-auto flex items-center gap-4 z-10">
        <button 
          onClick={() => { SoundManager.playClick(); onViewChange('landing'); }}
          className="p-2.5 bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-lg font-black text-white font-orbitron uppercase tracking-wide">
            {isRandomMode ? 'Random Chat' : 'Match Setup'}
          </h1>
          <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
            {isRandomMode ? 'Anyone Online' : 'Stranger Frequency'}
          </p>
        </div>
      </header>

      {/* Core Setup Form Panel */}
      <main className="max-w-2xl w-full mx-auto bg-slate-900/40 backdrop-blur-xl border border-slate-850/80 rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl my-2 sm:my-6 z-10">
        <form onSubmit={handleStartSearch} className="space-y-8">
          {!reconnectTarget && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { SoundManager.playClick(); onMatchModeChange?.('random'); }}
                className={`rounded-xl border px-3 py-2.5 text-[10px] font-bold font-orbitron uppercase tracking-widest transition-all ${
                  isRandomMode
                    ? 'border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]'
                    : 'border-slate-850 bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                <Shuffle size={12} className="inline mr-1 -mt-0.5" />
                Random
              </button>
              <button
                type="button"
                onClick={() => { SoundManager.playClick(); onMatchModeChange?.('smart'); }}
                className={`rounded-xl border px-3 py-2.5 text-[10px] font-bold font-orbitron uppercase tracking-widest transition-all ${
                  !isRandomMode
                    ? 'border-[#bc34fa] bg-[#bc34fa]/10 text-[#bc34fa]'
                    : 'border-slate-850 bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                Smart Match
              </button>
            </div>
          )}

          {isRandomMode && !reconnectTarget && (
            <div className="rounded-xl border border-[#00f2fe]/25 bg-[#00f2fe]/10 px-4 py-3 text-sm text-[#d7fbff]">
              <span className="font-bold">Random mode:</span> you will be paired with the next available person — no mood or interest filters.
            </div>
          )}

          {reconnectTarget && (
            <div className="rounded-xl border border-[#00f2fe]/20 bg-[#00f2fe]/10 px-4 py-3 text-sm text-[#d7fbff]">
              Reconnect mode is on. We will try to match you with <span className="font-bold">{reconnectTarget}</span>.
            </div>
          )}
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
              {errorMessage}
            </div>
          )}
          
          {/* User Nickname Generation */}
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
                required={!isRandomMode}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-850 rounded-2xl pl-4 pr-12 py-4 text-white text-base font-semibold focus:outline-none focus:border-[#bc34fa] focus:ring-2 focus:ring-[#bc34fa]/10 transition-all placeholder-slate-700"
                placeholder="e.g. NeonGhost492"
                maxLength={25}
              />
              <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-600 font-mono text-[10px] tracking-widest">
                {username.length}/25
              </span>
            </div>
          </div>

          {!isRandomMode && !reconnectTarget && (
            <>
              {/* Mood Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest font-orbitron text-slate-400 block">Select Current Mood</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {MOODS_LIST.map((mood) => {
                    const isActive = selectedMood === mood.id;
                    return (
                      <button
                        key={mood.id}
                        type="button"
                        onClick={() => handleSelectMood(mood.id)}
                        className={`
                          flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl border text-center transition-all active:scale-[0.95]
                          ${isActive 
                            ? 'bg-gradient-to-b from-[#bc34fa]/20 to-[#ff007f]/10 border-[#bc34fa] shadow-[0_0_15px_rgba(188,52,250,0.15)] text-white' 
                            : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-400'}
                        `}
                      >
                        <span className="text-xl mb-1">{mood.emoji}</span>
                        <span className="text-[10px] font-bold font-orbitron uppercase tracking-wider">{mood.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interest Multi-Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest font-orbitron text-slate-400 block">Select Areas of Interest</label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS_LIST.map((interest) => {
                    const isSelected = selectedInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => handleInterestToggle(interest)}
                        className={`
                          px-4 py-2 text-xs font-bold font-orbitron uppercase tracking-widest rounded-xl border transition-all active:scale-[0.95] flex items-center gap-1.5
                          ${isSelected 
                            ? 'bg-[#00f2fe]/10 border-[#00f2fe] text-white shadow-[0_0_15px_rgba(0,242,254,0.15)]' 
                            : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-400'}
                        `}
                      >
                        <Hash size={12} className={isSelected ? 'text-[#00f2fe]' : 'text-slate-700'} />
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Connect Match Trigger */}
          <button 
            type="submit" 
            className={`w-full py-4.5 rounded-2xl text-white font-bold tracking-widest font-orbitron uppercase text-sm shadow-[0_0_20px_rgba(188,52,250,0.2)] hover:shadow-[0_0_30px_rgba(188,52,250,0.4)] active:scale-[0.98] transition-all ${
              isRandomMode
                ? 'bg-gradient-to-r from-[#00f2fe] to-[#bc34fa]'
                : 'bg-gradient-to-r from-[#bc34fa] via-[#ff007f] to-[#00f2fe]'
            }`}
          >
            {isRandomMode ? 'Start Random Chat' : 'Commence Matchmaking Scan'}
          </button>
        </form>
      </main>

      {/* Safety info footer */}
      <footer className="max-w-2xl w-full mx-auto flex items-center justify-center gap-2 text-slate-600 text-[10px] font-mono tracking-wide z-10">
        <Shield size={12} className="text-[#ff007f]" />
        ANONYMOUS CENSORSHIP FILTERS ARE ENGAGED. BE RESPECTFUL.
      </footer>
    </div>
  );
}

export default MatchPage;
