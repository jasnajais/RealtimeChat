import { Bell, MessageCircle, Users, Sparkles, Award, ShieldAlert, Zap, Shuffle } from 'lucide-react';
import SoundManager from '../components/SoundManager';

function LandingPage({
  onlineCount = 0,
  onViewChange,
  onRandomChat,
  role = 'user',
  liveUsers = { count: 0, users: [] },
  onEnableNotifications,
  notificationsEnabled = false
}) {
  const handleRandomChat = () => {
    SoundManager.playClick();
    if (onRandomChat) {
      onRandomChat();
    } else {
      onViewChange('match');
    }
  };

  const handleLeaderboard = () => {
    SoundManager.playClick();
    onViewChange('leaderboard');
  };

  const handleEnableNotifications = () => {
    SoundManager.playClick();
    onEnableNotifications?.();
  };

  const liveUserList = Array.isArray(liveUsers.users) ? liveUsers.users : [];
  const activeCount = liveUsers?.count ?? onlineCount;

  return (
    <div className="page-shell bg-[#07070c] relative flex flex-col gap-6 sm:gap-8 select-none">
      <header className="max-w-6xl w-full mx-auto z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl shrink-0">
              <MessageCircle size={22} className="text-[#bc34fa] animate-pulse sm:w-6 sm:h-6" />
            </div>
            <span className="text-lg sm:text-xl font-black text-white tracking-wider font-orbitron truncate">
              NEON<span className="text-[#bc34fa]">CHAT</span>
            </span>
          </div>
        </div>

        <nav className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full">
          <button
            onClick={handleLeaderboard}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-[10px] sm:text-xs font-bold font-orbitron uppercase tracking-widest text-[#00f2fe] border border-[#00f2fe]/20 hover:border-[#00f2fe] bg-[#00f2fe]/5 rounded-xl transition-all"
          >
            Leaderboard
          </button>
          <button
            type="button"
            onClick={() => { SoundManager.playClick(); onViewChange('profile'); }}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-[10px] sm:text-xs font-bold font-orbitron uppercase tracking-widest text-slate-300 border border-slate-800 hover:border-slate-700 bg-slate-900 rounded-xl transition-all"
          >
            Profile
          </button>
          {role === 'admin' && (
            <button
              type="button"
              onClick={() => { SoundManager.playClick(); onViewChange('admin'); }}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-[10px] sm:text-xs font-bold font-orbitron uppercase tracking-widest text-amber-300 border border-amber-500/20 hover:border-amber-400 bg-amber-500/5 rounded-xl transition-all"
            >
              Admin
            </button>
          )}
        </nav>
      </header>

      <main className="max-w-4xl w-full mx-auto flex flex-col items-center text-center sm:my-6 md:my-10 z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-6 float-slow">
          <Sparkles size={12} className="text-[#00f2fe]" />
          Random chat only
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-7xl font-black text-white tracking-tighter mb-4 uppercase leading-tight sm:leading-none font-orbitron">
          Anonymous <br />
          Stranger <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#bc34fa] via-[#ff007f] to-[#00f2fe] neon-text-purple">Random Chat</span>
        </h1>

        <p className="text-slate-400 max-w-xl text-sm md:text-base leading-relaxed mb-8">
          Jump into a live stranger chat in one tap. There are no mood filters, no interest setup, and no extra game modes to manage.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md w-full mb-8 sm:mb-10">
          <div className="bg-slate-950/60 border border-slate-850 rounded-2xl p-4 flex flex-col items-center">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest font-orbitron mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Online Now
            </div>
            <span className="text-2xl font-black text-white font-orbitron">{onlineCount}</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-850 rounded-2xl p-4 flex flex-col items-center">
            <div className="flex items-center gap-2 text-[#00f2fe] text-xs font-bold uppercase tracking-widest font-orbitron mb-1">
              <Zap size={12} />
              Matches Created
            </div>
            <span className="text-2xl font-black text-white font-orbitron">14.3K+</span>
          </div>
        </div>

        <div className="w-full max-w-2xl mb-10 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="rounded-2xl border border-slate-850 bg-slate-950/50 px-4 py-3 text-left">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <Users size={12} className="text-[#00f2fe]" />
              Live Global Active Users
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {liveUserList.length > 0 ? liveUserList.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300"
                >
                  {name}
                </span>
              )) : (
                <span className="text-xs text-slate-500">No live usernames yet, but the room is awake.</span>
              )}
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-slate-600">
              {activeCount} active connections
            </p>
          </div>

          <button
            type="button"
            onClick={handleEnableNotifications}
            className={`rounded-2xl border px-4 py-3 text-left transition-all ${
              notificationsEnabled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-slate-850 bg-slate-950/50 text-slate-300 hover:border-[#bc34fa]/40 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
              <Bell size={12} className={notificationsEnabled ? 'text-emerald-300' : 'text-[#bc34fa]'} />
              {notificationsEnabled ? 'Notifications Enabled' : 'Enable Push Alerts'}
            </div>
            <p className="mt-2 text-xs text-slate-500">Get notified when you match with someone new.</p>
          </button>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-lg">
          <button
            onClick={handleRandomChat}
            className="w-full px-8 py-5 rounded-2xl bg-gradient-to-r from-[#00f2fe] to-[#bc34fa] hover:from-[#33f5ff] hover:to-[#d546ff] text-slate-950 font-black tracking-widest font-orbitron uppercase text-sm shadow-[0_0_45px_rgba(0,242,254,0.35)] hover:shadow-[0_0_60px_rgba(0,242,254,0.55)] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 relative overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
            <Shuffle size={20} className="animate-pulse" />
            <span className="relative">Random Chat</span>
            <span className="ml-2 relative inline-flex items-center rounded-full bg-slate-950/20 border border-slate-950/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
              LIVE NOW
            </span>
          </button>


          {/* Multiplayer removed - keep only random stranger chat */}
          <div className="h-1" />

        </div>

        <p className="mt-4 max-w-md text-[11px] text-slate-500 leading-relaxed">
          <span className="text-[#00f2fe] font-semibold">Random Chat</span> connects you instantly with whoever is waiting.
          Keep it anonymous, respectful, and fast.
        </p>
      </main>

      <section className="max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 my-6 z-10">
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-850/60 rounded-2xl p-5 hover:border-purple-500/30 transition-colors">
          <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl w-max mb-4">
            <Award size={20} className="text-[#bc34fa]" />
          </div>
          <h3 className="text-base font-bold text-white font-orbitron mb-2 uppercase tracking-wide">Earn Badges & XP</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Gain XP for sending messages and staying active. Level up to unlock badges and profile rewards.
          </p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-850/60 rounded-2xl p-5 hover:border-[#00f2fe]/30 transition-colors">
          <div className="p-2 bg-[#00f2fe]/10 border border-[#00f2fe]/20 rounded-xl w-max mb-4">
            <Shuffle size={20} className="text-[#00f2fe]" />
          </div>
          <h3 className="text-base font-bold text-white font-orbitron mb-2 uppercase tracking-wide">Instant Random Pairing</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Jump straight into a live stranger chat with no setup, no filters, and no game mode switching.
          </p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-850/60 rounded-2xl p-5 hover:border-pink-500/30 transition-colors">
          <div className="p-2 bg-pink-500/10 border border-pink-500/20 rounded-xl w-max mb-4">
            <ShieldAlert size={20} className="text-[#ff007f]" />
          </div>
          <h3 className="text-base font-bold text-white font-orbitron mb-2 uppercase tracking-wide">Safety & Moderation</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Enjoy secure messaging with built-in toxic message filters, report buttons, spam limits, and anonymous username generation.
          </p>
        </div>
      </section>

      <footer className="text-center py-4 text-[10px] text-slate-600 font-mono tracking-widest uppercase">
        (c) 2026 NEON CHAT PLATFORM. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}

export default LandingPage;
