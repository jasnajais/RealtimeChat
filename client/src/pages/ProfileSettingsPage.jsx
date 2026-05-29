import { useEffect, useState } from 'react';
import { ArrowLeft, Bell, BadgeCheck, Flame, Shield, UserCog, RefreshCw } from 'lucide-react';
import SoundManager from '../components/SoundManager';

const API_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000';

function ProfileSettingsPage({ username, role, onViewChange, onEnableNotifications, notificationsEnabled = false }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(username));
  const [error, setError] = useState(() => (username ? '' : 'No username found in session.'));
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('neon_sound') !== 'off');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('neon_compact_mode') === 'on');

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const token = localStorage.getItem('neon_jwt_token');
        const res = await fetch(`${API_URL}/api/stats/profile/${encodeURIComponent(username)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to load profile.');
        if (!cancelled) setProfile(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (username) loadProfile();

    return () => {
      cancelled = true;
    };
  }, [username]);

  const toggleSound = () => {
    SoundManager.playClick();
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem('neon_sound', next ? 'on' : 'off');
  };

  const toggleCompact = () => {
    SoundManager.playClick();
    const next = !compactMode;
    setCompactMode(next);
    localStorage.setItem('neon_compact_mode', next ? 'on' : 'off');
  };

  return (
    <div className="page-shell bg-[#07070c] text-slate-200">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => { SoundManager.playClick(); onViewChange('landing'); }}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-white"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            Profile / Settings
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-[#bc34fa] to-[#ff007f] font-black text-white">
                {username?.slice(0, 2).toUpperCase() || '??'}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Current account</div>
                <h1 className="mt-1 text-2xl sm:text-3xl font-black uppercase tracking-wide text-white break-all">{username || 'Anonymous'}</h1>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#00f2fe]/20 bg-[#00f2fe]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#00f2fe]">
                    {role || 'user'}
                  </span>
                  {notificationsEnabled && (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                      Notifications on
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <Flame size={12} className="text-[#ff007f]" />
                  Streak
                </div>
                <div className="mt-2 text-2xl font-black text-white">{profile?.streak || 1}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <BadgeCheck size={12} className="text-[#00f2fe]" />
                  Level
                </div>
                <div className="mt-2 text-2xl font-black text-white">{profile?.level || 1}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <Shield size={12} className="text-amber-300" />
                  Moderation
                </div>
                <div className="mt-2 text-2xl font-black text-white">{profile?.moderationScore || 0}</div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Progress</div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#bc34fa] to-[#00f2fe]"
                  style={{ width: `${profile?.levelProgress || 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {profile?.xp || 0} XP toward {profile?.xpNeeded || 100} XP
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <UserCog size={14} className="text-[#bc34fa]" />
                Settings
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={toggleSound}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-left"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">Sound effects</div>
                    <div className="text-xs text-slate-500">Controls click and message audio cues</div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${soundOn ? 'text-emerald-300' : 'text-slate-500'}`}>
                    {soundOn ? 'On' : 'Off'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={toggleCompact}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-left"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">Compact mode</div>
                    <div className="text-xs text-slate-500">Tightens the interface for denser scanning</div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${compactMode ? 'text-[#00f2fe]' : 'text-slate-500'}`}>
                    {compactMode ? 'On' : 'Off'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onEnableNotifications}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-left"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">Push notifications</div>
                    <div className="text-xs text-slate-500">Get match and message alerts in browser</div>
                  </div>
                  <Bell size={16} className={notificationsEnabled ? 'text-emerald-300' : 'text-slate-500'} />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Account details</div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Badges</span>
                  <span className="text-white">{(profile?.badges || []).length}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Blocked users</span>
                  <span className="text-white">{profile?.blockedCount || 0}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Status</span>
                  <span className={profile?.isBanned ? 'text-rose-300' : 'text-emerald-300'}>
                    {profile?.isBanned ? 'Banned' : 'Active'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loading && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">Loading profile...</div>}
        {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">{error}</div>}

        <button
          type="button"
          onClick={() => { SoundManager.playClick(); onViewChange('leaderboard'); }}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#00f2fe]/20 bg-[#00f2fe]/5 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#00f2fe]"
        >
          <RefreshCw size={14} />
          Open Leaderboard
        </button>
      </div>
    </div>
  );
}

export default ProfileSettingsPage;
