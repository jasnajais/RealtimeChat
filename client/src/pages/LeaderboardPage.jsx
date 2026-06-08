import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Flame, Trophy, BadgeCheck, Sparkles, RefreshCw } from 'lucide-react';
import SoundManager from '../components/SoundManager';

import { BACKEND_URL as API_URL } from '../config/backend';

function BadgeList({ badges = [] }) {
  if (!badges.length) return <span className="text-xs text-slate-500">No badges yet</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.slice(0, 4).map((badge) => (
        <span
          key={badge}
          className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-300"
        >
          <BadgeCheck size={10} className="text-[#00f2fe]" />
          {badge}
        </span>
      ))}
    </div>
  );
}

function LeaderboardPage({ username, onViewChange }) {
  const [entries, setEntries] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/stats/leaderboard?username=${encodeURIComponent(username || '')}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to load leaderboard.');
      }

      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setCurrentUser(data.currentUser || null);
    } catch (err) {
      setError(err.message || 'Unable to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    let cancelled = false;

    const loadLeaderboard = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await fetch(`${API_URL}/api/stats/leaderboard?username=${encodeURIComponent(username || '')}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Unable to load leaderboard.');
        }

        if (!cancelled) {
          setEntries(Array.isArray(data.entries) ? data.entries : []);
          setCurrentUser(data.currentUser || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load leaderboard.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [username]);

  const topBadgeCount = useMemo(() => entries.reduce((sum, entry) => sum + (entry.badges?.length || 0), 0), [entries]);

  return (
    <div className="page-shell bg-[#07070c] text-slate-200">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => { SoundManager.playClick(); onViewChange('landing'); }}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-white"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <button
            type="button"
            onClick={() => { SoundManager.playClick(); fetchLeaderboard(); }}
            className="flex items-center gap-2 rounded-xl border border-[#00f2fe]/20 bg-[#00f2fe]/5 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#00f2fe] hover:border-[#00f2fe]"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        <section className="flex flex-col gap-3 border-b border-slate-800 pb-5">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#bc34fa]">
            <Sparkles size={12} />
            Leaderboard
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wide text-white">XP, streaks, and badges</h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Points come from chatting, keeping a daily streak, and finishing prompts. Badges mark the people who keep showing up.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <Trophy size={14} className="text-amber-300" />
              Top Players
            </div>
            <div className="mt-2 text-2xl font-black text-white">{entries.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <Flame size={14} className="text-[#ff007f]" />
              Your Streak
            </div>
            <div className="mt-2 text-2xl font-black text-white">{currentUser?.streak || 1}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <BadgeCheck size={14} className="text-[#00f2fe]" />
              Badges Earned
            </div>
            <div className="mt-2 text-2xl font-black text-white">{topBadgeCount}</div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">Loading leaderboard...</div>
        ) : (
          <>
            <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="grid grid-cols-[72px_1.2fr_0.7fr_0.7fr_0.8fr] gap-3 border-b border-slate-800 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <span>Rank</span>
                <span>Player</span>
                <span>XP</span>
                <span>Streak</span>
                <span>Badges</span>
              </div>

              <div className="divide-y divide-slate-800">
                {entries.map((entry) => {
                  const isSelf = entry.username === username;
                  return (
                    <div
                      key={entry.username}
                      className={`grid grid-cols-[72px_1.2fr_0.7fr_0.7fr_0.8fr] gap-3 px-4 py-4 text-sm ${
                        isSelf ? 'bg-white/5' : ''
                      }`}
                    >
                      <div className="flex items-center">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                          entry.rank === 1 ? 'bg-amber-400/15 text-amber-300' : entry.rank === 2 ? 'bg-slate-700 text-slate-200' : entry.rank === 3 ? 'bg-orange-500/15 text-orange-300' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {entry.rank}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold text-white">{entry.username}</span>
                          {isSelf && <span className="rounded-full border border-[#00f2fe]/20 bg-[#00f2fe]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#00f2fe]">You</span>}
                        </div>
                        <BadgeList badges={entry.badges} />
                      </div>
                      <div className="flex items-center font-black text-white">{entry.xp}</div>
                      <div className="flex items-center font-black text-white">{entry.streak || 1}</div>
                      <div className="flex items-center text-slate-300">{(entry.badges || []).length}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="md:hidden space-y-3">
              {entries.map((entry) => {
                const isSelf = entry.username === username;
                return (
                  <div
                    key={entry.username}
                    className={`rounded-2xl border border-slate-800 bg-slate-900 p-4 ${isSelf ? 'ring-1 ring-[#00f2fe]/30' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                          entry.rank === 1 ? 'bg-amber-400/15 text-amber-300' : entry.rank === 2 ? 'bg-slate-700 text-slate-200' : entry.rank === 3 ? 'bg-orange-500/15 text-orange-300' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {entry.rank}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold text-white">{entry.username}</span>
                            {isSelf && <span className="rounded-full border border-[#00f2fe]/20 bg-[#00f2fe]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#00f2fe]">You</span>}
                          </div>
                          <BadgeList badges={entry.badges} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl border border-slate-800 bg-slate-950 px-2 py-2">
                        <div className="text-[9px] uppercase tracking-widest text-slate-500">XP</div>
                        <div className="mt-1 font-black text-white">{entry.xp}</div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950 px-2 py-2">
                        <div className="text-[9px] uppercase tracking-widest text-slate-500">Streak</div>
                        <div className="mt-1 font-black text-white">{entry.streak || 1}</div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950 px-2 py-2">
                        <div className="text-[9px] uppercase tracking-widest text-slate-500">Badges</div>
                        <div className="mt-1 font-black text-white">{(entry.badges || []).length}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default LeaderboardPage;
