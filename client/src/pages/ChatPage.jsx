import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Send,
  Sparkles,
  Flag,
  CheckCircle,
  Flame,
  Ban,
  ShieldAlert,
  Bell,
  Share2,
  Smile,
  Image,
  Copy,
  X,
  Zap
} from 'lucide-react';
import SoundManager from '../components/SoundManager';
import { generateIcebreaker } from '../components/Icebreakers';

const EMPTY_INTERESTS = [];
const QUICK_REACTIONS = ['😂', '🔥', '❤️', '👏', '😮'];

function ChatPage({
  socket,
  username,
  matchDetails,
  onSkip,
  onNotify,
  onEnableNotifications,
  notificationsEnabled = false
}) {
  const {
    strangerName,
    roomId,
    commonInterests: matchedInterests = EMPTY_INTERESTS,
    strangerMood = 'chill'
  } = matchDetails;

  const commonInterests = Array.isArray(matchedInterests) ? matchedInterests : EMPTY_INTERESTS;

  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStrangerTyping, setIsStrangerTyping] = useState(false);
  const [isTypingSelf, setIsTypingSelf] = useState(false);
  const [manualIcebreaker, setManualIcebreaker] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Spam');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [safetyNotice, setSafetyNotice] = useState('');
  const [levelUpData, setLevelUpData] = useState(null);
  const [gifUrl, setGifUrl] = useState('');
  const [showGifInput, setShowGifInput] = useState(false);
  const [reactionTarget, setReactionTarget] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const safetyNoticeTimeoutRef = useRef(null);
  const sessionExitHandledRef = useRef(false);

  const icebreakerKey = `${strangerMood}:${commonInterests.join('|')}`;
  const generatedIcebreaker = useMemo(
    () => generateIcebreaker(commonInterests, strangerMood),
    [commonInterests, strangerMood]
  );
  const icebreaker = manualIcebreaker?.key === icebreakerKey ? manualIcebreaker.value : generatedIcebreaker;

  const appendSystemMessage = useCallback((message) => {
    setMessages((prev) => [...prev, { type: 'system', message }]);
  }, []);

  const handleSessionExit = useCallback((message) => {
    if (sessionExitHandledRef.current) return;
    sessionExitHandledRef.current = true;
    appendSystemMessage(message);
    setTimeout(() => onSkip(), 1500);
  }, [appendSystemMessage, onSkip]);

  const maybeNotify = useCallback((title, body) => {
    if (typeof onNotify === 'function') {
      onNotify(title, body);
    }
  }, [onNotify]);

  const handleCycleIcebreaker = () => {
    SoundManager.playClick();
    setManualIcebreaker({
      key: icebreakerKey,
      value: generateIcebreaker(commonInterests, strangerMood)
    });
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);

    if (!socket) return;

    if (!isTypingSelf) {
      setIsTypingSelf(true);
      socket.emit('stranger-typing', { roomId, isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTypingSelf(false);
      socket.emit('stranger-typing', { roomId, isTyping: false });
    }, 1500);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!socket) return;

    const cleanMsg = inputMessage.trim();
    const cleanGif = gifUrl.trim();
    if (!cleanMsg && !(showGifInput && cleanGif)) return;

    SoundManager.playClick();

    if (showGifInput && cleanGif) {
      socket.emit('stranger-message', {
        roomId,
        message: cleanMsg,
        gifUrl: cleanGif,
        contentType: 'gif'
      });
      setGifUrl('');
      setShowGifInput(false);
    } else {
      socket.emit('stranger-message', { roomId, message: cleanMsg });
    }

    setInputMessage('');

    if (isTypingSelf) {
      setIsTypingSelf(false);
      socket.emit('stranger-typing', { roomId, isTyping: false });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleSendEmoji = (emoji) => {
    SoundManager.playClick();
    if (socket) socket.emit('stranger-message', { roomId, message: emoji });
  };

  const handleNextStranger = () => {
    SoundManager.playClick();
    if (socket) socket.emit('skip-match', { roomId });
    onSkip();
  };

  const handleSubmitReport = () => {
    SoundManager.playClick();
    if (!socket) return;

    socket.emit('report-stranger', { roomId, reason: reportReason });
    setReportSubmitted(true);
    setTimeout(() => {
      setShowReportModal(false);
      setReportSubmitted(false);
      handleNextStranger();
    }, 1800);
  };

  const handleBlockUser = () => {
    SoundManager.playClick();
    if (socket) socket.emit('block-user', { roomId, targetUsername: strangerName });
  };

  const handleSendReaction = useCallback((messageId, emoji) => {
    if (!socket || !roomId || !messageId || !emoji) return;
    SoundManager.playClick();
    socket.emit('message-reaction', { roomId, messageId, emoji });
    setReactionTarget(null);
  }, [socket, roomId]);

  const handleShareMessage = useCallback(async (msg) => {
    if (!msg) return;
    const text = msg.contentType === 'gif'
      ? `${msg.caption ? `${msg.caption}\n` : ''}${msg.gifUrl}`
      : msg.message;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Funny moment from NeonChat',
          text
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        appendSystemMessage('Funny moment copied to clipboard.');
      }
    } catch (err) {
      console.warn('Share failed', err);
    }
  }, [appendSystemMessage]);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (data) => {
      SoundManager.playMsg();
      setMessages((prev) => [...prev, data]);
      const preview = data?.contentType === 'gif'
        ? `Shared a GIF${data?.caption ? `: ${data.caption}` : ''}`
        : data?.message || 'New message';
      if (data?.sender !== username && (document.hidden || notificationsEnabled)) {
        maybeNotify('New stranger message', preview);
      }
    };

    const handleReaction = (payload = {}) => {
      const { messageId, reactions = [] } = payload;
      if (!messageId) return;
      setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, reactions } : msg)));
    };

    socket.on('stranger-message', handleIncomingMessage);
    socket.on('stranger-typing', (data) => setIsStrangerTyping(Boolean(data?.isTyping)));
    socket.on('stranger-skipped', () => handleSessionExit('Stranger skipped the session.'));
    socket.on('stranger-disconnected', () => handleSessionExit('Stranger disconnected.'));
    socket.on('moderation-warning', (data) => {
      const notice = data?.message || 'A message was moderated.';
      appendSystemMessage(notice);
      setSafetyNotice(notice);
      if (safetyNoticeTimeoutRef.current) clearTimeout(safetyNoticeTimeoutRef.current);
      safetyNoticeTimeoutRef.current = setTimeout(() => setSafetyNotice(''), 3500);
    });
    socket.on('user-blocked', (data) => {
      appendSystemMessage(data?.message || `Blocked ${data?.username || 'stranger'}.`);
      handleSessionExit('The chat ended after blocking the other user.');
    });
    socket.on('blocked-by-user', (data) => {
      appendSystemMessage(data?.message || 'The other user blocked you.');
      handleSessionExit('The chat ended because the other user blocked you.');
    });
    socket.on('session-timeout', (data) => {
      handleSessionExit(data?.message || 'The chat ended because of inactivity.');
    });
    socket.on('match-ended', (data) => {
      handleSessionExit(data?.message || data?.reason || 'This chat session ended.');
    });
    socket.on('message-reaction', handleReaction);
    socket.on('level-up', (data) => {
      SoundManager.playLevelUp();
      setLevelUpData(data);
      import('canvas-confetti')
        .then((confetti) => {
          confetti.default({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#bc34fa', '#ff007f', '#00f2fe']
          });
        })
        .catch((err) => console.warn(err));
    });

    return () => {
      socket.off('stranger-message', handleIncomingMessage);
      socket.off('stranger-typing');
      socket.off('stranger-skipped');
      socket.off('stranger-disconnected');
      socket.off('moderation-warning');
      socket.off('user-blocked');
      socket.off('blocked-by-user');
      socket.off('session-timeout');
      socket.off('match-ended');
      socket.off('message-reaction', handleReaction);
      socket.off('level-up');
      if (safetyNoticeTimeoutRef.current) clearTimeout(safetyNoticeTimeoutRef.current);
    };
  }, [socket, roomId, username, notificationsEnabled, maybeNotify, handleSessionExit, appendSystemMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 bg-[#07070c] text-slate-300 overflow-hidden relative">
      {levelUpData && (
        <div className="absolute inset-0 z-50 bg-[#07070c]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-xs space-y-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-[#bc34fa] to-[#ff007f] p-1 mx-auto shadow-[0_0_35px_rgba(188,52,250,0.5)]">
              <div className="w-full h-full bg-[#07070c] rounded-full flex items-center justify-center font-black text-2xl text-white font-orbitron">
                LVL {levelUpData.level}
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white uppercase font-orbitron tracking-wide animate-pulse">Level Increased!</h2>
              <p className="text-xs text-slate-400">Your social standing increases. Keep chatting to claim more titles!</p>
            </div>
            {levelUpData.badges?.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-center gap-2">
                <Flame size={16} className="text-[#ff007f]" />
                <span className="text-xs font-bold text-white font-orbitron uppercase tracking-widest">
                  {levelUpData.badges[levelUpData.badges.length - 1]}
                </span>
              </div>
            )}
            <button
              onClick={() => setLevelUpData(null)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#bc34fa] to-[#ff007f] text-white text-xs font-bold uppercase tracking-widest font-orbitron shadow-lg shadow-purple-500/20 active:scale-[0.98]"
            >
              Resume Chat
            </button>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="absolute inset-0 z-40 bg-[#07070c]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 relative">
            <h3 className="text-lg font-black text-white font-orbitron uppercase tracking-wide mb-2">Report Stranger</h3>
            <p className="text-xs text-slate-400 mb-5">Flagging this user will save chat logs for moderation and block them immediately.</p>

            {reportSubmitted ? (
              <div className="text-center py-6 flex flex-col items-center gap-2">
                <CheckCircle size={32} className="text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">Report registered successfully.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Select Reason</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#bc34fa]"
                  >
                    <option value="Spam">Spamming / Advertising</option>
                    <option value="Vulgarity">Extreme Vulgarity / Harassment</option>
                    <option value="Inappropriate">Inappropriate Visuals / Profile</option>
                    <option value="Bot">Automated Bot behaviors</option>
                    <option value="Other">Other Violations</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 py-3 border border-slate-850 rounded-xl text-xs font-bold font-orbitron uppercase tracking-widest text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitReport}
                    className="flex-1 py-3 bg-[#ff007f] text-white text-xs font-bold font-orbitron uppercase tracking-widest rounded-xl hover:bg-rose-600 active:scale-[0.98] transition-all"
                  >
                    Submit Flag
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col relative min-h-0 min-w-0">
        <header className="shrink-0 p-3 sm:p-4 bg-slate-900 border-b border-slate-850 flex flex-col gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 shrink-0 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 font-mono">
              👤
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-sm font-bold text-white font-orbitron tracking-wide">{strangerName}</span>
                <span className="shrink-0 text-[10px] py-0.5 px-2 bg-[#00f2fe]/10 border border-[#00f2fe]/20 text-[#00f2fe] rounded-full uppercase font-bold font-orbitron tracking-widest">
                  Random
                </span>
              </div>
              {commonInterests.length > 0 ? (
                <span className="block truncate text-[9px] text-slate-500 uppercase tracking-widest font-mono">Interests: {commonInterests.join(', ')}</span>
              ) : (
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Random Match</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
            <button
              onClick={() => onEnableNotifications?.()}
              className={`touch-target shrink-0 p-2.5 rounded-xl border text-xs font-bold font-orbitron uppercase tracking-widest flex items-center gap-1.5 transition-all ${
                notificationsEnabled
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white'
              }`}
              title="Enable Push Notifications"
            >
              <Bell size={15} />
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              className="touch-target shrink-0 p-2.5 bg-slate-950 border border-slate-850 hover:border-slate-800 text-rose-400 hover:text-rose-300 rounded-xl"
              title="Report User"
            >
              <Flag size={15} />
            </button>

            <button
              onClick={handleBlockUser}
              className="touch-target shrink-0 p-2.5 bg-slate-950 border border-slate-850 hover:border-slate-800 text-amber-400 hover:text-amber-300 rounded-xl"
              title="Block User"
            >
              <Ban size={15} />
            </button>

            <button
              onClick={handleNextStranger}
              className="touch-target shrink-0 px-3 sm:px-4 py-2.5 bg-gradient-to-r from-[#bc34fa] to-[#ff007f] hover:from-[#d546ff] hover:to-[#ff2396] text-white text-xs font-black font-orbitron uppercase tracking-widest rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center gap-1"
            >
              <Zap size={14} className="fill-current" />
              Next
            </button>
          </div>
        </header>

        {safetyNotice && (
          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              <ShieldAlert size={14} className="shrink-0 text-amber-300" />
              <span className="leading-snug">{safetyNotice}</span>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 md:p-6 space-y-4 bg-slate-950/60 scrollbar-thin">
          {icebreaker && (
            <div className="bg-slate-900/60 border border-purple-500/20 rounded-2xl p-4 max-w-xl mx-auto flex flex-col md:flex-row items-center gap-4 text-center md:text-left relative overflow-hidden my-2 shadow-[0_0_15px_rgba(188,52,250,0.05)]">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl shrink-0">
                <Sparkles size={20} className="text-[#bc34fa]" />
              </div>
              <div className="space-y-1 flex-1">
                <span className="text-[9px] font-bold text-[#bc34fa] uppercase tracking-widest font-orbitron">AI Icebreaker Suggestion</span>
                <p className="text-xs text-slate-300 italic leading-relaxed">"{icebreaker}"</p>
              </div>
              <button
                onClick={handleCycleIcebreaker}
                className="text-[9px] font-bold uppercase tracking-widest text-[#00f2fe] border border-[#00f2fe]/20 hover:border-[#00f2fe] bg-[#00f2fe]/5 py-1.5 px-3 rounded-lg transition-all"
              >
                Skip Tip
              </button>
            </div>
          )}

          {messages.map((msg, index) => {
            if (msg.type === 'system') {
              return (
                <div key={index} className="flex justify-center my-3">
                  <span className="bg-slate-900 border border-slate-850/60 text-slate-500 text-[10px] tracking-wider py-1 px-3.5 rounded-full font-mono">
                    {msg.message}
                  </span>
                </div>
              );
            }

            const isOwn = msg.sender === username;
            const reactions = Array.isArray(msg.reactions) ? msg.reactions : [];
            const groupedReactions = reactions.reduce((acc, reaction) => {
              if (!reaction?.emoji) return acc;
              acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
              return acc;
            }, {});

            return (
              <div key={msg.id || index} className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'} chat-bubble-anim`}>
                <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`
                    rounded-2xl px-4 py-3 shadow-md overflow-hidden
                    ${isOwn
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-br-none'
                      : 'bg-slate-900 text-slate-200 border border-slate-850/60 rounded-bl-none'}
                  `}>
                    {msg.contentType === 'gif' && msg.gifUrl ? (
                      <div className="space-y-2">
                        {msg.caption && (
                          <p className="leading-relaxed text-sm whitespace-pre-wrap break-words">{msg.caption}</p>
                        )}
                        <img
                          src={msg.gifUrl}
                          alt={msg.caption || 'Shared GIF'}
                          className="max-h-64 rounded-xl border border-white/10 object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <p className="leading-relaxed text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleSendReaction(msg.id, emoji)}
                          className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-bold uppercase tracking-widest"
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setReactionTarget(reactionTarget === msg.id ? null : msg.id)}
                        className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-bold uppercase tracking-widest"
                      >
                        <Smile size={12} className="inline" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShareMessage(msg)}
                        className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-bold uppercase tracking-widest"
                      >
                        <Share2 size={12} className="inline" />
                      </button>
                    </div>

                    {reactionTarget === msg.id && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleSendReaction(msg.id, emoji)}
                            className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white"
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setReactionTarget(null)}
                          className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}

                    {Object.keys(groupedReactions).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(groupedReactions).map(([emoji, count]) => (
                          <span key={emoji} className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-bold">
                            {emoji} {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[8px] text-slate-600 mt-1 mx-2 font-mono">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                </span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="shrink-0 p-3 sm:p-4 bg-slate-900 border-t border-slate-850 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="h-5 -mt-3.5 mb-1 px-1 flex items-center text-[10px] text-[#bc34fa]/80 font-mono">
            {isStrangerTyping && (
              <div className="flex items-center gap-1 animate-pulse">
                <span>typing</span>
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-[#bc34fa] animate-bounce" />
                  <span className="w-1 h-1 rounded-full bg-[#bc34fa] animate-bounce [animation-delay:0.15s]" />
                  <span className="w-1 h-1 rounded-full bg-[#bc34fa] animate-bounce [animation-delay:0.3s]" />
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 hidden md:flex">
              {['🔥', '💀', '👽', '💍', '🥺'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSendEmoji(emoji)}
                  className="p-2 bg-slate-950 border border-slate-850 hover:bg-slate-850 text-base rounded-xl active:scale-[0.95] transition-all"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-2">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={handleInputChange}
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3.5 text-white placeholder-slate-700 text-sm focus:outline-none focus:border-[#bc34fa] focus:ring-2 focus:ring-[#bc34fa]/10 transition-all font-medium"
                  placeholder={showGifInput ? 'Add a caption for your GIF...' : 'Send a secure message to stranger...'}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() && !(showGifInput && gifUrl.trim())}
                  className="p-3.5 bg-[#bc34fa] hover:bg-purple-500 text-white rounded-2xl shadow-lg active:scale-[0.96] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                </button>
              </form>

              {showGifInput && (
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={gifUrl}
                    onChange={(e) => setGifUrl(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3 text-white placeholder-slate-700 text-xs focus:outline-none focus:border-[#00f2fe] focus:ring-2 focus:ring-[#00f2fe]/10 transition-all"
                    placeholder="Paste a GIF URL"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!gifUrl.trim()}
                    className="p-3 bg-[#00f2fe] hover:bg-cyan-400 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    GIF
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGifInput((prev) => !prev)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                    showGifInput
                      ? 'border-[#00f2fe]/30 bg-[#00f2fe]/10 text-[#00f2fe]'
                      : 'border-slate-850 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  <Image size={12} />
                  GIF
                </button>

                <button
                  type="button"
                  onClick={() => setReactionTarget(null)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-850 bg-slate-950 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                >
                  <Copy size={12} />
                  Share / Reactions Ready
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;
