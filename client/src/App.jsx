import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import LandingPage from './pages/LandingPage';
import MatchPage from './pages/MatchPage';
import ChatPage from './pages/ChatPage';
import LeaderboardPage from './pages/LeaderboardPage';
import MultiplayerRoomPage from './pages/MultiplayerRoomPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000';
const socket = io(SOCKET_URL, { autoConnect: false });
const PREVIOUS_STRANGER_KEY = 'neon_previous_stranger';

function getStoredRole() {
  const storedRole = localStorage.getItem('neon_role');
  if (storedRole) return storedRole;

  const token = localStorage.getItem('neon_jwt_token');
  if (!token) return 'user';

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload?.role) {
      localStorage.setItem('neon_role', payload.role);
      return payload.role;
    }
  } catch {
    return 'user';
  }

  return 'user';
}

function App() {
  const [view, setView] = useState('landing');
  const [onlineCount, setOnlineCount] = useState(0);
  const [username, setUsername] = useState(() => localStorage.getItem('neon_username') || '');
  const [role] = useState(() => getStoredRole());
  const [matchDetails, setMatchDetails] = useState(null);
  const [notice, setNotice] = useState('');
  const [previousStranger, setPreviousStranger] = useState(() => localStorage.getItem(PREVIOUS_STRANGER_KEY) || '');
  const [reconnectTarget, setReconnectTarget] = useState('');
  const [matchMode, setMatchMode] = useState('smart');
  const [autoStartRandom, setAutoStartRandom] = useState(false);
  const [liveUsers, setLiveUsers] = useState({ count: 0, users: [] });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted');

  const notifyUser = useCallback((title, body) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification(title, { body });
  }, []);

  useEffect(() => {
    const handleOnlineCount = ({ count }) => setOnlineCount(count || 0);
    const handleLiveUsers = (payload = {}) => {
      setLiveUsers({
        count: payload.count || 0,
        users: Array.isArray(payload.users) ? payload.users : []
      });
    };
    const handleConnect = () => setNotice('');
    const handleConnectError = () => setNotice('Cannot reach the backend server.');
    const handleForceDisconnect = ({ message }) => {
      setNotice(message || 'Disconnected by server.');
      setMatchDetails(null);
      setView('landing');
    };

    socket.on('online-count-update', handleOnlineCount);
    socket.on('live-active-users-update', handleLiveUsers);
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('force-disconnect', handleForceDisconnect);
    socket.connect();

    return () => {
      socket.off('online-count-update', handleOnlineCount);
      socket.off('live-active-users-update', handleLiveUsers);
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('force-disconnect', handleForceDisconnect);
      socket.close();
    };
  }, []);

  const handleMatched = useCallback((details) => {
    setMatchDetails(details);
    setPreviousStranger(details?.strangerName || '');
    if (details?.strangerName) {
      localStorage.setItem(PREVIOUS_STRANGER_KEY, details.strangerName);
    }
    setReconnectTarget('');
    setView('chat');
    notifyUser('Matched', `You matched with ${details?.strangerName || 'someone'}.`);
  }, [notifyUser]);

  const handleSkip = useCallback(() => {
    setMatchDetails(null);
    setAutoStartRandom(matchMode === 'random');
    setView('match');
  }, [matchMode]);

  const handleViewChange = useCallback((nextView) => {
    if (nextView !== 'match') {
      setAutoStartRandom(false);
    }
    setView(nextView);
  }, []);

  const handleStartMatch = useCallback(() => {
    setMatchMode('smart');
    setReconnectTarget('');
    setAutoStartRandom(false);
    setView('match');
  }, []);

  const handleRandomChat = useCallback(() => {
    setMatchMode('random');
    setReconnectTarget('');
    setAutoStartRandom(true);
    setView('match');
  }, []);

  const handleReconnectPrevious = useCallback(() => {
    if (!previousStranger) return;
    setReconnectTarget(previousStranger);
    setView('match');
  }, [previousStranger]);

  const handleEnableNotifications = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      setNotice('Notifications are not supported in this browser.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
    if (permission !== 'granted') {
      setNotice('Notification permission was not granted.');
    }
  }, []);

  let page;
  if (view === 'match') {
    page = (
      <MatchPage
        socket={socket}
        username={username}
        setUsername={setUsername}
        onMatched={handleMatched}
        onViewChange={handleViewChange}
        reconnectTarget={reconnectTarget}
        matchMode={matchMode}
        onMatchModeChange={setMatchMode}
        autoStartRandom={autoStartRandom}
        onAutoStartConsumed={() => setAutoStartRandom(false)}
        onNotify={notifyUser}
      />
    );
  } else if (view === 'chat' && matchDetails) {
    page = (
      <ChatPage
        socket={socket}
        username={username}
        matchDetails={matchDetails}
        onSkip={handleSkip}
        onNotify={notifyUser}
        onEnableNotifications={handleEnableNotifications}
        notificationsEnabled={notificationsEnabled}
      />
    );
  } else if (view === 'leaderboard') {
    page = (
      <LeaderboardPage
        username={username}
        onViewChange={handleViewChange}
      />
    );
  } else if (view === 'multiplayer') {
    page = (
      <MultiplayerRoomPage
        socket={socket}
        username={username}
        onViewChange={handleViewChange}
      />
    );
  } else if (view === 'profile') {
    page = (
      <ProfileSettingsPage
        username={username}
        role={role}
        onViewChange={handleViewChange}
        onEnableNotifications={handleEnableNotifications}
        notificationsEnabled={notificationsEnabled}
      />
    );
  } else if (view === 'admin') {
    page = (
      <AdminDashboardPage
        username={username}
        role={role}
        onViewChange={handleViewChange}
      />
    );
  } else {
    page = (
      <LandingPage
        onlineCount={onlineCount}
        onViewChange={handleViewChange}
        onStartMatch={handleStartMatch}
        onRandomChat={handleRandomChat}
        role={role}
        previousStranger={previousStranger}
        onReconnectPrevious={handleReconnectPrevious}
        liveUsers={liveUsers}
        onEnableNotifications={handleEnableNotifications}
        notificationsEnabled={notificationsEnabled}
      />
    );
  }

  return (
    <>
      {notice && (
        <div className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-50 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 rounded-lg border border-rose-500/30 bg-rose-950 px-3 py-2.5 sm:px-4 sm:py-3 text-center text-xs sm:text-sm font-semibold text-rose-100 shadow-xl">
          {notice}
        </div>
      )}
      {page}
    </>
  );
}

export default App;
