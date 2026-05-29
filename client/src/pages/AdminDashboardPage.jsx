import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ShieldAlert, Users, Flag, Ban, CheckCircle2, RefreshCw, Search } from 'lucide-react';
import SoundManager from '../components/SoundManager';

const API_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000';

function AdminDashboardPage({ username, role, onViewChange }) {
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('reports');

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('neon_jwt_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const reloadAdminData = useCallback(async () => {
    try {
      const [reportsRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/mod/reports`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/mod/users`, { headers: authHeaders() })
      ]);

      const reportsData = await reportsRes.json();
      const usersData = await usersRes.json();

      if (!reportsRes.ok) throw new Error(reportsData.message || 'Failed to load reports.');
      if (!usersRes.ok) throw new Error(usersData.message || 'Failed to load users.');

      setReports(Array.isArray(reportsData) ? reportsData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      setError(err.message || 'Failed to load admin data.');
    }
  }, [authHeaders]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await reloadAdminData();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadAdminData]);

  const handleResolve = async (id) => {
    SoundManager.playClick();
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/mod/reports/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not resolve report.');
      await reloadAdminData();
    } catch (err) {
      setError(err.message || 'Could not resolve report.');
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async (userName) => {
    SoundManager.playClick();
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/mod/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ username: userName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not ban user.');
      await reloadAdminData();
    } catch (err) {
      setError(err.message || 'Could not ban user.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (userName) => {
    SoundManager.playClick();
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/mod/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ username: userName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not unban user.');
      await reloadAdminData();
    } catch (err) {
      setError(err.message || 'Could not unban user.');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      return [
        user.username,
        user.role,
        user.badges?.join(' '),
        user.isBanned ? 'banned' : 'active'
      ].join(' ').toLowerCase().includes(q);
    });
  }, [users, search]);

  const stats = useMemo(() => ({
    reports: reports.length,
    unresolved: reports.filter((r) => !r.resolved).length,
    banned: users.filter((u) => u.isBanned).length,
    admins: users.filter((u) => u.role === 'admin').length
  }), [reports, users]);

  if (role !== 'admin') {
    return (
      <div className="page-shell bg-[#07070c] text-slate-200">
        <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-300">
            <ShieldAlert size={28} />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wide text-white">Admin access required</h1>
          <p className="text-sm text-slate-400">This dashboard is only available to admin accounts.</p>
          <button
            type="button"
            onClick={() => { SoundManager.playClick(); onViewChange('landing'); }}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-300"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell bg-[#07070c] text-slate-200">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => { SoundManager.playClick(); onViewChange('landing'); }}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-white"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-amber-200 text-center">
            <ShieldAlert size={14} className="shrink-0" />
            <span className="hidden sm:inline">Admin Moderation Dashboard</span>
            <span className="sm:hidden">Admin Dashboard</span>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Reports</div>
            <div className="mt-2 text-3xl font-black text-white">{stats.reports}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Open</div>
            <div className="mt-2 text-3xl font-black text-white">{stats.unresolved}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Banned</div>
            <div className="mt-2 text-3xl font-black text-white">{stats.banned}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Admins</div>
            <div className="mt-2 text-3xl font-black text-white">{stats.admins}</div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tabs</div>
            <div className="mt-3 space-y-2">
              {[
                { id: 'reports', label: 'Reports', icon: Flag },
                { id: 'users', label: 'Users', icon: Users }
              ].map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left text-xs font-bold uppercase tracking-widest ${
                      active
                        ? 'border-[#bc34fa]/30 bg-[#bc34fa]/10 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon size={14} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                SoundManager.playClick();
                setLoading(true);
                setError('');
                reloadAdminData().finally(() => setLoading(false));
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#00f2fe]/20 bg-[#00f2fe]/5 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#00f2fe]"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-wide text-white">
                    {activeTab === 'reports' ? 'Moderation reports' : 'Registered users'}
                  </h1>
                  <p className="mt-1 text-sm text-slate-400">
                    Signed in as {username}. Keep the room civil.
                  </p>
                </div>

                {activeTab === 'users' && (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                    <Search size={14} className="text-slate-500" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search users"
                      className="bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {loading && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">Loading admin data...</div>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">
                {error}
              </div>
            )}

            {!loading && activeTab === 'reports' && (
              <div className="space-y-3">
                {reports.length > 0 ? reports.map((report) => (
                  <div key={report._id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[#00f2fe]/20 bg-[#00f2fe]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#00f2fe]">
                            {report.reason || 'Report'}
                          </span>
                          {report.resolved && (
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                              Resolved
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-lg font-bold text-white">
                          {report.reportedUser} reported by {report.reporter}
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {Array.isArray(report.messages) && report.messages.length > 0
                            ? report.messages.slice(0, 2).join(' | ')
                            : 'No message log available.'}
                        </p>
                      </div>
                      {!report.resolved && (
                        <button
                          type="button"
                          onClick={() => handleResolve(report._id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#bc34fa] to-[#ff007f] px-4 py-3 text-xs font-black uppercase tracking-widest text-white"
                        >
                          <CheckCircle2 size={14} />
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">No moderation reports yet.</div>
                )}
              </div>
            )}

            {!loading && activeTab === 'users' && (
              <div className="space-y-3">
                {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                  <div key={user.username} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-white">{user.username}</h3>
                          <span className="rounded-full border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                            {user.role}
                          </span>
                          {user.isBanned && (
                            <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-300">
                              Banned
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-400">
                          XP {user.xp} | Level {user.level} | Streak {user.streak || 1} | Moderation {user.moderationScore || 0}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {user.isBanned ? (
                          <button
                            type="button"
                            onClick={() => handleUnban(user.username)}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-emerald-300"
                          >
                            <CheckCircle2 size={14} />
                            Unban
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleBan(user.username)}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-rose-300"
                          >
                            <Ban size={14} />
                            Ban
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">No users matched your search.</div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
