const { User } = require('../models/User');
const { Match } = require('../models/Match');
const { Report } = require('../models/Report');
const { generateTempUsername } = require('../utils/usernames');
const { updateDailyStreak } = require('../utils/gamification');

// Matchmaking queues & active rooms state
let matchmakingQueue = [];
const activeMatches = new Map();     // roomId -> { user1, user2, messages: [] }
const multiplayerRooms = new Map();  // roomCode -> { players: [], hostSocketId }
let globalOnlineCount = 0;
const socketModerationState = new Map();
const socketUsernames = new Map();

const RATE_LIMIT_WINDOW_MS = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS || 10000);
const RATE_LIMIT_MAX_MESSAGES = Number(process.env.CHAT_RATE_LIMIT_MAX_MESSAGES || 5);
const SPAM_REPEAT_WINDOW_MS = Number(process.env.CHAT_SPAM_REPEAT_WINDOW_MS || 15000);
const MATCH_INACTIVITY_TIMEOUT_MS = Number(process.env.CHAT_INACTIVITY_TIMEOUT_MS || 10 * 60 * 1000);
const QUEUE_INACTIVITY_TIMEOUT_MS = Number(process.env.MATCH_QUEUE_TIMEOUT_MS || 15 * 60 * 1000);
const TOXICITY_STRIKE_THRESHOLD = Number(process.env.TOXICITY_STRIKE_THRESHOLD || 3);
const MODERATION_STRIKE_BAN_THRESHOLD = Number(process.env.MODERATION_STRIKE_BAN_THRESHOLD || 5);

// Dynamic Truth & Dare Questions Bank
const TRUTH_DARE_BANK = {
  funny: {
    truths: [
      "What is the most embarrassing thing you've done in public?",
      "Have you ever walked into a glass door? Describe the moment.",
      "If you could only eat one food for the rest of your life, what would it be?",
      "What is the weirdest search query in your browser history?",
      "Have you ever pretended to recognize someone when you had no idea who they were?"
    ],
    dares: [
      "Type the next 3 messages using a pirate accent (e.g. Ahoy, matey!).",
      "Text your best friend that you just saw a green alien flying outside.",
      "Send the stranger your most hilarious pickup line.",
      "Close your eyes and type a 10-word message, then send it without correcting typos.",
      "Act like a hyperactive sportscaster for the next 2 minutes of chat."
    ]
  },
  chaos: {
    truths: [
      "What is a lie you told that you still feel guilty about?",
      "Have you ever snooped through someone else's phone or belongings?",
      "What is the most rebellious thing you've ever done?",
      "If you could swap lives with any celebrity for 24 hours, who would it be?",
      "What is a secret you've never shared with your best friend?"
    ],
    dares: [
      "Change your chat text color to red and type in all caps for 5 messages.",
      "Reveal the last photo in your phone's photo library (describe it in detail).",
      "Confess your most controversial opinion right now.",
      "Ask the stranger to give you any dare and promise to type 'Yes Master' in response.",
      "Text a random contact 'I know what you did' and describe their reaction."
    ]
  },
  friendship: {
    truths: [
      "What is the qualities you value most in a true friend?",
      "What is your biggest dream or aspiration in life?",
      "What was your first impression of this chat room?",
      "What is a hobby or interest you have that most people don't know about?",
      "If you could travel anywhere in the world right now, where would you go?"
    ],
    dares: [
      "Give the stranger a genuine, deep compliment.",
      "Recommend a movie, book, or song that changed your perspective.",
      "Share a funny childhood memory that always makes you smile.",
      "Ask the stranger 3 deep questions about their life goals.",
      "Write a short, creative 4-line poem about friendship right now."
    ]
  },
  flirty: {
    truths: [
      "What is your biggest turn-on in a person?",
      "Do you believe in love at first sight, or should I walk by again?",
      "What was your most romantic date or encounter?",
      "What is a secret crush you've had recently?",
      "Describe your perfect romantic evening."
    ],
    dares: [
      "Describe the stranger's vibe in a highly poetic, flattering way.",
      "Send a message telling the stranger what you find most attractive about their vibe.",
      "Try to make the stranger blush using only words.",
      "Ask the stranger out on a mock virtual date and describe the menu.",
      "Type a message starting with 'Honestly, you look like a...'"
    ]
  },
  latenight: {
    truths: [
      "What is a deep thought that keeps you awake at 3 AM?",
      "Do you believe in ghosts, aliens, or the paranormal?",
      "What is your biggest fear about the future?",
      "Have you ever had a dream that felt so real it changed your day?",
      "What is your definition of happiness?"
    ],
    dares: [
      "Type your messages in all lowercase with spaces between letters for 2 minutes.",
      "Tell a ghost story or creepy legend in 3 sentences.",
      "Confess a weird midnight habit you have.",
      "Describe a dream you had recently that confused you.",
      "Describe how you feel right now in a single, honest paragraph."
    ]
  }
};

// Emojis for toxic keyword replacements
const FUN_EMOJIS = ['🦄', '✨', '🔥', '👑', '💀', '👽', '👾', '🚀', '💖', '🍭'];
const TOXIC_KEYWORDS = [
  /\bshit\b/gi, /\bfuck\b/gi, /\bbitch\b/gi, /\basshole\b/gi, 
  /\bcunt\b/gi, /\bdick\b/gi, /\bpussy\b/gi, /\bbastard\b/gi
];

function filterToxicity(text) {
  let filtered = text;
  TOXIC_KEYWORDS.forEach(regex => {
    filtered = filtered.replace(regex, () => {
      return FUN_EMOJIS[Math.floor(Math.random() * FUN_EMOJIS.length)];
    });
  });
  return filtered;
}

function normalizeInterests(interests) {
  if (!Array.isArray(interests)) return [];

  return interests
    .filter(interest => typeof interest === 'string')
    .map(interest => interest.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeMood(mood) {
  return typeof mood === 'string' && mood.trim() ? mood.trim().toLowerCase() : 'chill';
}

function buildLiveUserSnapshot(io) {
  const names = [];
  if (!io?.sockets?.sockets) {
    return { count: globalOnlineCount, users: names };
  }

  for (const socket of io.sockets.sockets.values()) {
    if (socket.data?.username) {
      names.push(socket.data.username);
    }
  }

  const uniqueUsers = [...new Set(names)].slice(0, 8);
  return {
    count: globalOnlineCount,
    users: uniqueUsers
  };
}

function emitLiveUserSnapshot(io) {
  if (!io) return;
  io.emit('live-active-users-update', buildLiveUserSnapshot(io));
}

function getSocketState(socketId) {
  if (!socketModerationState.has(socketId)) {
    socketModerationState.set(socketId, {
      lastActive: Date.now(),
      messageTimes: [],
      recentMessages: [],
      spamWarnings: 0,
      rateLimitWarnings: 0,
      username: null
    });
  }

  return socketModerationState.get(socketId);
}

function touchSocketActivity(socketId, username = null) {
  const state = getSocketState(socketId);
  state.lastActive = Date.now();
  if (username) {
    state.username = username;
  }
  return state;
}

function fingerprintMessage(message) {
  return message
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function countToxicKeywords(message) {
  const lower = message.toLowerCase();
  const toxicWords = ['shit', 'fuck', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'bastard'];
  return toxicWords.reduce((count, word) => count + (lower.includes(word) ? 1 : 0), 0);
}

function moderateOutgoingMessage(message, state) {
  const now = Date.now();
  state.messageTimes = state.messageTimes.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  state.recentMessages = state.recentMessages.filter((entry) => now - entry.at < SPAM_REPEAT_WINDOW_MS);

  const fingerprint = fingerprintMessage(message);
  const repeatCount = state.recentMessages.filter((entry) => entry.fingerprint === fingerprint).length;
  const keywordHits = countToxicKeywords(message);
  const uppercaseLetters = (message.match(/[A-Z]/g) || []).length;
  const alphaLetters = (message.match(/[a-zA-Z]/g) || []).length;
  const capsRatio = alphaLetters > 0 ? uppercaseLetters / alphaLetters : 0;
  const repeatedCharacters = /(.)\1{6,}/i.test(message.replace(/\s+/g, ''));
  const hasSpamLink = /(https?:\/\/|www\.)/i.test(message);
  const isFlooding = state.messageTimes.length >= RATE_LIMIT_MAX_MESSAGES;
  const isSpamRepeat = repeatCount >= 2;
  const isSpamLike = repeatedCharacters || capsRatio > 0.8 || (hasSpamLink && repeatCount >= 1);

  state.messageTimes.push(now);
  state.recentMessages.push({ fingerprint, at: now });

  if (keywordHits >= TOXICITY_STRIKE_THRESHOLD) {
    return {
      action: 'block',
      reason: 'Message blocked for toxic language.',
      sanitizedMessage: null,
      moderationScore: 2
    };
  }

  if (isFlooding) {
    state.rateLimitWarnings += 1;
    return {
      action: 'rate-limit',
      reason: 'You are sending messages too quickly. Slow down a bit.',
      sanitizedMessage: null,
      moderationScore: 0
    };
  }

  if (isSpamRepeat || isSpamLike) {
    state.spamWarnings += 1;
    return {
      action: 'spam',
      reason: hasSpamLink ? 'Repeated promotional links are limited.' : 'Spam-like messaging detected.',
      sanitizedMessage: filterToxicity(message),
      moderationScore: 1
    };
  }

  return {
    action: keywordHits > 0 ? 'filtered' : 'allow',
    reason: keywordHits > 0 ? 'Toxic language was filtered.' : '',
    sanitizedMessage: filterToxicity(message),
    moderationScore: keywordHits > 0 ? 1 : 0
  };
}

function getMatchParticipant(match, socketId) {
  if (!match) return null;
  if (match.user1.socketId === socketId) return match.user2;
  if (match.user2.socketId === socketId) return match.user1;
  return null;
}

async function getUserSnapshot(username, cache) {
  if (!username) return null;
  if (cache.has(username)) return cache.get(username);
  const user = await User.findOne({ username });
  cache.set(username, user);
  return user;
}

function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function addBlockedUser(blockerUsername, targetUsername) {
  const user = await User.findOne({ username: blockerUsername });
  if (!user) return null;

  user.blockedUsers = Array.isArray(user.blockedUsers) ? user.blockedUsers : [];
  if (!user.blockedUsers.includes(targetUsername)) {
    user.blockedUsers.push(targetUsername);
  }
  user.lastActive = new Date();
  await user.save();
  return user;
}

function findQueueEntry(username) {
  return matchmakingQueue.find((entry) => entry.username === username) || null;
}

async function queueReconnectRequest(socket, username, targetUsername, interests = [], mood = 'chill') {
  const cleanTarget = typeof targetUsername === 'string' ? targetUsername.trim() : '';
  if (!cleanTarget) {
    socket.emit('reconnect-failed', { message: 'No previous stranger selected.' });
    return;
  }

  socketUsernames.set(socket.id, username);
  socket.data.username = username;
  touchSocketActivity(socket.id, username);

  const queuedTarget = findQueueEntry(cleanTarget);
  if (queuedTarget) {
    socket.emit('waiting', {
      username,
      message: `Trying to reconnect with ${cleanTarget}...`
    });

    matchmakingQueue = matchmakingQueue.filter((entry) => entry.socketId !== socket.id && entry.username !== username);
    matchmakingQueue.push({
      username,
      socketId: socket.id,
      interests: normalizeInterests(interests),
      mood: normalizeMood(mood),
      joinedAt: Date.now(),
      preferredPartnerUsername: cleanTarget,
      reconnectMode: true
    });

    tryMatchUsers().catch(console.error);
    return;
  }

  matchmakingQueue = matchmakingQueue.filter((entry) => entry.socketId !== socket.id && entry.username !== username);
  matchmakingQueue.push({
    username,
    socketId: socket.id,
    interests: normalizeInterests(interests),
    mood: normalizeMood(mood),
    joinedAt: Date.now(),
    preferredPartnerUsername: cleanTarget,
    reconnectMode: true
  });

  socket.emit('waiting', {
    username,
    message: `Waiting to reconnect with ${cleanTarget}...`
  });
  tryMatchUsers().catch(console.error);
}

async function applyModerationStrike(username, amount, socket = null) {
  const user = await User.findOne({ username });
  if (!user) return null;

  user.moderationScore = (user.moderationScore || 0) + amount;
  user.lastActive = new Date();

  if (user.moderationScore >= MODERATION_STRIKE_BAN_THRESHOLD) {
    user.isBanned = true;
  }

  await user.save();

  if (socket) {
    socket.emit('moderation-score-updated', {
      username: user.username,
      moderationScore: user.moderationScore,
      isBanned: user.isBanned
    });
  }

  return user;
}

function leaveSocketFromRoom(io, socketId, roomId) {
  const socket = io?.sockets?.sockets?.get(socketId);
  if (socket) {
    socket.leave(roomId);
  }
}

function endMatchSession(roomId, reason, eventName = 'match-ended', senderSocketId = null) {
  const match = activeMatches.get(roomId);
  if (!match) return null;

  const io = global.ioPointer;
  if (io) {
    leaveSocketFromRoom(io, match.user1.socketId, roomId);
    leaveSocketFromRoom(io, match.user2.socketId, roomId);

    io.to(match.user1.socketId).emit(eventName, {
      roomId,
      reason,
      message: reason
    });

    io.to(match.user2.socketId).emit(eventName, {
      roomId,
      reason,
      message: reason
    });
  }

  activeMatches.delete(roomId);
  return match;
}

// Gamification helper to add XP and badge rewards
async function rewardXp(username, amount, socket) {
  try {
    const user = await User.findOne({ username });
    if (!user) return;

    updateDailyStreak(user);
    user.xp += amount;
    const oldLevel = user.level;
    // Level boundary every 100 XP
    const newLevel = Math.floor(user.xp / 100) + 1;

    if (newLevel > oldLevel) {
      user.level = newLevel;
      
      // Level badges
      if (newLevel === 2 && !user.badges.includes('Dare Devil')) {
        user.badges.push('Dare Devil');
      }
      if (newLevel === 5 && !user.badges.includes('Chaos King')) {
        user.badges.push('Chaos King');
      }
      if (newLevel === 10 && !user.badges.includes('Night Owl')) {
        user.badges.push('Night Owl');
      }
      
      socket.emit('level-up', {
        level: newLevel,
        xp: user.xp,
        badges: user.badges,
        message: `🔥 CRITICAL LEVEL UP! You reached Level ${newLevel}! ✨`
      });
    }

    await user.save();
    socket.emit('xp-updated', {
      xp: user.xp,
      level: user.level,
      badges: user.badges
    });
  } catch (err) {
    console.error('Error rewarding XP:', err);
  }
}

function handleSocket(io) {
  io.on('connection', async (socket) => {
    globalOnlineCount++;
    io.emit('online-count-update', { count: globalOnlineCount });
    emitLiveUserSnapshot(io);

    console.log(`🔌 Socket connection established: ${socket.id}`);
    touchSocketActivity(socket.id);

    // Check if socket matches a user name
    let socketUser = null;

    socket.on('register-socket', async ({ username } = {}) => {
      try {
        if (!username) return;
        const user = await User.findOne({ username });
        if (user && user.isBanned) {
          socket.emit('force-disconnect', { message: 'Banned' });
          socket.disconnect(true);
          return;
        }
        socketUser = username;
        socket.data.username = username;
        socketUsernames.set(socket.id, username);
        touchSocketActivity(socket.id, username);
        emitLiveUserSnapshot(io);
        console.log(`🔗 Socket ${socket.id} linked to username: ${username}`);
      } catch (err) {
        console.error(err);
      }
    });

    // Matchmaking events
    const handleJoinQueue = async (data = {}) => {
      const requestedUsername = typeof data.username === 'string' ? data.username.trim() : '';
      const username = requestedUsername || socketUser || generateTempUsername();

      try {
        const existing = await User.findOne({ username });
        if (existing && existing.isBanned) {
          socket.emit('force-disconnect', { message: 'Banned' });
          socket.disconnect(true);
          return;
        }
      } catch (err) {
        console.error(err);
      }

      socketUser = username;
      socket.data.username = username;
      socketUsernames.set(socket.id, username);
      touchSocketActivity(socket.id, username);
      emitLiveUserSnapshot(io);

      const randomMode = Boolean(data.randomMode);

      matchmakingQueue = matchmakingQueue.filter((q) => q.socketId !== socket.id);
      matchmakingQueue.push({
        username,
        socketId: socket.id,
        interests: randomMode ? [] : normalizeInterests(data.interests),
        mood: randomMode ? 'any' : normalizeMood(data.mood),
        joinedAt: Date.now(),
        randomMode
      });

      socket.emit('waiting', {
        username,
        randomMode,
        message: randomMode
          ? 'Looking for anyone online...'
          : 'Waiting for a partner...'
      });
      tryMatchUsers().catch(console.error);
      setTimeout(() => tryMatchUsers().catch(console.error), 250);
    };

    socket.on('join-match-queue', handleJoinQueue);
    socket.on('join-random-chat', (data = {}) => handleJoinQueue({ ...data, randomMode: true }));

    socket.on('reconnect-previous-stranger', async ({ username, targetUsername, interests = [], mood = 'chill' } = {}) => {
      const cleanUsername = typeof username === 'string' ? username.trim() : socketUser || '';
      if (!cleanUsername) return;
      await queueReconnectRequest(socket, cleanUsername, targetUsername, interests, mood);
    });

    socket.on('leave-match-queue', () => {
      const leaving = matchmakingQueue.find((q) => q.socketId === socket.id);
      matchmakingQueue = matchmakingQueue.filter((q) => q.socketId !== socket.id);
      console.log(`🚪 [Queue] User ${leaving?.username || socket.id} left matchmaking`);
    });

    // Skip/Next stranger
    socket.on('skip-match', ({ roomId } = {}) => {
      if (!roomId) return;
      handleSkip(roomId, socket.id);
    });

    // 1v1 Stranger Message
    socket.on('stranger-message', async (payload = {}) => {
      const { roomId } = payload;
      const rawMessage = typeof payload === 'string' ? payload : payload.message;
      const gifUrl = typeof payload === 'object' && typeof payload.gifUrl === 'string' ? payload.gifUrl.trim() : '';
      const contentType = typeof payload === 'object' && typeof payload.contentType === 'string' ? payload.contentType : 'text';
      const match = activeMatches.get(roomId);
      if (!match || !socketUser) return;
      if ((contentType !== 'gif' && typeof rawMessage !== 'string') && !gifUrl) return;

      const state = touchSocketActivity(socket.id, socketUser);
      match.lastActivity = Date.now();
      const sanitizedMessage = typeof rawMessage === 'string' ? rawMessage.trim() : '';
      const moderated = contentType === 'gif'
        ? { action: 'allow', sanitizedMessage: sanitizedMessage || gifUrl, moderationScore: 0 }
        : moderateOutgoingMessage(sanitizedMessage, state);
      const messageId = generateMessageId();

      if (moderated.action === 'rate-limit') {
        socket.emit('moderation-warning', { roomId, message: moderated.reason, type: 'rate-limit' });
        if (state.rateLimitWarnings >= 3) {
          endMatchSession(roomId, 'Disconnected after repeated rate limiting.');
        }
        return;
      }

      if (moderated.action === 'block') {
        socket.emit('moderation-warning', { roomId, message: moderated.reason, type: 'toxicity-block' });
        const updated = await applyModerationStrike(socketUser, moderated.moderationScore || 1, socket);
        if (updated && updated.isBanned) {
          socket.emit('force-disconnect', { message: 'You were removed by moderation.' });
          socket.disconnect(true);
        }
        return;
      }

      if (moderated.action === 'spam') {
        socket.emit('moderation-warning', { roomId, message: moderated.reason, type: 'spam' });
        await applyModerationStrike(socketUser, moderated.moderationScore || 1, socket);
        if (state.spamWarnings >= 3) {
          endMatchSession(roomId, 'Disconnected for spam-like activity.');
          return;
        }
      }

      const messageObj = {
        id: messageId,
        sender: socketUser,
        message: contentType === 'gif' ? (sanitizedMessage || gifUrl) : (moderated.sanitizedMessage || filterToxicity(sanitizedMessage)),
        timestamp: new Date().toISOString(),
        reactions: [],
        contentType: contentType === 'gif' ? 'gif' : 'text',
        gifUrl: contentType === 'gif' ? gifUrl : '',
        caption: contentType === 'gif' ? sanitizedMessage : ''
      };

      match.messages.push(messageObj);

      // Route message to both participants
      io.to(roomId).emit('stranger-message', messageObj);
      socket.emit('message-delivered', {
        timestamp: messageObj.timestamp,
        moderated: moderated.action !== 'allow',
        action: moderated.action
      });

      // Reward XP (+1 XP per sent chat message)
      await rewardXp(socketUser, 1, socket);
    });

    // Typing Status Scoped
    socket.on('stranger-typing', ({ roomId, isTyping }) => {
      if (!socketUser || !roomId) return;
      touchSocketActivity(socket.id, socketUser);
      const match = activeMatches.get(roomId);
      if (match) {
        match.lastActivity = Date.now();
      }
      socket.to(roomId).emit('stranger-typing', {
        username: socketUser,
        isTyping
      });
    });

    // Truth or Dare events
    socket.on('trigger-truth-or-dare', async ({ roomId, mode, type }) => {
      if (!roomId || !mode || !type || !socketUser) return;
      
      const bank = TRUTH_DARE_BANK[mode.toLowerCase()] || TRUTH_DARE_BANK.funny;
      const prompts = type === 'truth' ? bank.truths : bank.dares;
      const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];

      io.to(roomId).emit('truth-or-dare-prompt', {
        asker: socketUser,
        type,
        mode,
        prompt: selectedPrompt
      });

      // Reward initiator XP
      await rewardXp(socketUser, 5, socket);
      const match = activeMatches.get(roomId);
      if (match) {
        match.lastActivity = Date.now();
      }
    });

    socket.on('complete-truth-dare', async ({ roomId }) => {
      if (!socketUser || !roomId) return;
      // Award answering user high XP
      await rewardXp(socketUser, 15, socket);
      const match = activeMatches.get(roomId);
      if (match) {
        match.lastActivity = Date.now();
      }
      io.to(roomId).emit('truth-dare-completed-notice', {
        username: socketUser,
        message: `🎉 ${socketUser} completed their challenge and gained +15 XP! ✨`
      });
    });

    // Multiplayer room events
    socket.on('join-multiplayer-lobby', ({ username, roomCode }) => {
      if (!roomCode || !username) return;
      
      const cleanCode = roomCode.trim().toUpperCase();
      socketUser = username;
      socket.data.username = username;
      touchSocketActivity(socket.id, username);
      socket.join(cleanCode);

      let room = multiplayerRooms.get(cleanCode);
      if (!room) {
        room = {
          players: [],
          hostSocketId: socket.id
        };
        multiplayerRooms.set(cleanCode, room);
      }

      // Add player
      if (!room.players.some(p => p.username === username)) {
        room.players.push({
          username,
          socketId: socket.id,
          joinedAt: new Date()
        });
      }

      console.log(`🎮 [Group] User ${username} joined lobby ${cleanCode}`);

      // Broadcast list to everyone in room
      io.to(cleanCode).emit('multiplayer-player-list', {
        players: room.players.map(p => p.username),
        host: room.players.find(p => p.socketId === room.hostSocketId)?.username || username
      });
    });

    socket.on('spin-the-wheel', ({ roomCode }) => {
      if (!roomCode) return;
      const room = multiplayerRooms.get(roomCode.trim().toUpperCase());
      if (!room || room.hostSocketId !== socket.id) return; // Only host spins

      const players = room.players;
      if (players.length === 0) return;

      const selectedIndex = Math.floor(Math.random() * players.length);
      const selectedUser = players[selectedIndex];

      // Broadcast spinning result
      io.to(roomCode.trim().toUpperCase()).emit('wheel-spinning', {
        selectedIndex,
        selectedUsername: selectedUser.username,
        spinDuration: 3000
      });
    });

    socket.on('multiplayer-message', ({ roomCode, message }) => {
      if (!socketUser || !roomCode || typeof message !== 'string' || !message.trim()) return;
      touchSocketActivity(socket.id, socketUser);
      const filtered = filterToxicity(message.trim());
      io.to(roomCode.trim().toUpperCase()).emit('multiplayer-message', {
        sender: socketUser,
        message: filtered,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('message-reaction', ({ roomId, messageId, emoji } = {}) => {
      const match = activeMatches.get(roomId);
      if (!match || !socketUser || !messageId || !emoji) return;

      const targetMessage = match.messages.find((msg) => msg.id === messageId);
      if (!targetMessage) return;

      targetMessage.reactions = Array.isArray(targetMessage.reactions) ? targetMessage.reactions : [];
      const existingIndex = targetMessage.reactions.findIndex((reaction) => reaction.emoji === emoji && reaction.by === socketUser);
      if (existingIndex === -1) {
        targetMessage.reactions.push({ emoji, by: socketUser });
      }

      io.to(roomId).emit('message-reaction', {
        roomId,
        messageId,
        emoji,
        by: socketUser,
        reactions: targetMessage.reactions
      });
    });

    // Report user flags
    socket.on('report-stranger', async ({ roomId, reason }) => {
      const match = activeMatches.get(roomId);
      if (!match || !socketUser) return;

      const reportedPartner = getMatchParticipant(match, socket.id);
      const reportedUser = reportedPartner?.username;
      const reportedSocketId = reportedPartner?.socketId;

      if (!reportedUser) return;
      
      const logs = match.messages.map(m => `[${m.sender}]: ${m.message}`);

      try {
        let reportedProfile = null;
        if (reportedUser) {
          reportedProfile = await applyModerationStrike(reportedUser, 1);
        }
        await Report.create({
          reportedUser,
          reporter: socketUser,
          reason: reason || 'No reason provided',
          messages: logs
        });
        
        socket.emit('report-submitted', { success: true });
        console.log(`⚠️ [Moderation] Report registered: ${socketUser} reported ${reportedUser}`);

        if (reportedSocketId) {
          io.to(reportedSocketId).emit('moderation-warning', {
            roomId,
            message: 'The other user reported you. The session is ending.',
            type: 'report'
          });

          if (reportedProfile?.isBanned) {
            const reportedSocket = io.sockets.sockets.get(reportedSocketId);
            if (reportedSocket) {
              reportedSocket.emit('force-disconnect', {
                message: 'You were removed by moderation.'
              });
              reportedSocket.disconnect(true);
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('block-user', async ({ roomId, targetUsername } = {}) => {
      const match = activeMatches.get(roomId);
      if (!match || !socketUser) return;

      const partner = getMatchParticipant(match, socket.id);
      const blockedUser = targetUsername || partner?.username;
      if (!blockedUser) return;

      try {
        await addBlockedUser(socketUser, blockedUser);
      } catch (err) {
        console.error(err);
      }

      socket.emit('user-blocked', {
        username: blockedUser,
        message: `Blocked ${blockedUser}.`
      });

      if (partner?.socketId) {
        io.to(partner.socketId).emit('blocked-by-user', {
          roomId,
          username: socketUser,
          message: `${socketUser} blocked you.`
        });
      }

      endMatchSession(roomId, 'Blocked by user.');
    });

    socket.on('disconnect', () => {
      globalOnlineCount = Math.max(0, globalOnlineCount - 1);
      io.emit('online-count-update', { count: globalOnlineCount });

      // Remove from matchmaking queue
      matchmakingQueue = matchmakingQueue.filter(q => q.socketId !== socket.id);

      // Clean active matches
      for (const [roomId, match] of activeMatches.entries()) {
        if (match.user1.socketId === socket.id || match.user2.socketId === socket.id) {
          endMatchSession(roomId, 'Stranger disconnected.', 'stranger-disconnected', socket.id);
          console.log(`💔 Match room ${roomId} closed due to disconnect`);
        }
      }

      // Clean multiplayer rooms
      for (const [roomCode, room] of multiplayerRooms.entries()) {
        const index = room.players.findIndex(p => p.socketId === socket.id);
        if (index !== -1) {
          const leavingUser = room.players[index].username;
          room.players.splice(index, 1);

          if (room.players.length === 0) {
            multiplayerRooms.delete(roomCode);
          } else {
            // Re-assign host if needed
            if (room.hostSocketId === socket.id) {
              room.hostSocketId = room.players[0].socketId;
            }
            io.to(roomCode).emit('multiplayer-player-list', {
              players: room.players.map(p => p.username),
              host: room.players.find(p => p.socketId === room.hostSocketId)?.username || ''
            });
            io.to(roomCode).emit('multiplayer-message', {
              sender: 'SYSTEM',
              message: `${leavingUser} left the lobby.`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      socketModerationState.delete(socket.id);
      socketUsernames.delete(socket.id);
      emitLiveUserSnapshot(io);
    });
  });
}

// Matchmaking logic checker
let matchingInProgress = false;
async function tryMatchUsers() {
  if (matchingInProgress || matchmakingQueue.length < 2) return;
  const io = global.ioPointer;
  if (!io) return;

  matchingInProgress = true;

  try {
    const userCache = new Map();

    for (let i = 0; i < matchmakingQueue.length; i++) {
      const u1 = matchmakingQueue[i];
      const u1Doc = await getUserSnapshot(u1.username, userCache);

      if (u1Doc?.isBanned) {
        matchmakingQueue = matchmakingQueue.filter((entry) => entry.socketId !== u1.socketId);
        continue;
      }

      let bestMatchIndex = -1;
      let highestScore = -1;

      for (let j = i + 1; j < matchmakingQueue.length; j++) {
        const u2 = matchmakingQueue[j];
        const u2Doc = await getUserSnapshot(u2.username, userCache);

        if (u2Doc?.isBanned) {
          matchmakingQueue = matchmakingQueue.filter((entry) => entry.socketId !== u2.socketId);
          continue;
        }

        if (u1.username === u2.username) {
          continue;
        }

        const u1Blocked = Array.isArray(u1Doc?.blockedUsers) && u1Doc.blockedUsers.includes(u2.username);
        const u2Blocked = Array.isArray(u2Doc?.blockedUsers) && u2Doc.blockedUsers.includes(u1.username);
        if (u1Blocked || u2Blocked) {
          continue;
        }

        const reconnectPreferred =
          u1.preferredPartnerUsername === u2.username ||
          u2.preferredPartnerUsername === u1.username;
        if (reconnectPreferred) {
          bestMatchIndex = j;
          highestScore = Infinity;
          break;
        }

        const wantsRandomMatch = u1.randomMode || u2.randomMode;
        if (wantsRandomMatch) {
          bestMatchIndex = j;
          highestScore = Infinity;
          break;
        }

        const commonInterests = u1.interests.filter((x) => u2.interests.includes(x));
        const sharedMood = u1.mood === u2.mood ? 1 : 0;
        const score = (commonInterests.length * 2) + sharedMood;

        if (score > highestScore) {
          highestScore = score;
          bestMatchIndex = j;
        }
      }

      if (bestMatchIndex === -1 && matchmakingQueue.length >= 2) {
        const timeWaiting = Date.now() - u1.joinedAt;
        const waitThreshold = u1.randomMode ? 0 : 5000;
        if (timeWaiting >= waitThreshold) {
          for (let j = 0; j < matchmakingQueue.length; j++) {
            if (j === i) continue;
            const candidate = matchmakingQueue[j];
            if (candidate.username === u1.username) continue;
            const candidateDoc = await getUserSnapshot(candidate.username, userCache);
            const u1Blocked = Array.isArray(u1Doc?.blockedUsers) && u1Doc.blockedUsers.includes(candidate.username);
            const u2Blocked = Array.isArray(candidateDoc?.blockedUsers) && candidateDoc.blockedUsers.includes(u1.username);
            if (!u1Blocked && !u2Blocked && !candidateDoc?.isBanned) {
              bestMatchIndex = j;
              break;
            }
          }
        }
      }

      if (bestMatchIndex !== -1) {
        const u2 = matchmakingQueue[bestMatchIndex];
        const u2Doc = await getUserSnapshot(u2.username, userCache);

        const u1Blocked = Array.isArray(u1Doc?.blockedUsers) && u1Doc.blockedUsers.includes(u2.username);
        const u2Blocked = Array.isArray(u2Doc?.blockedUsers) && u2Doc.blockedUsers.includes(u1.username);
        if (u1Blocked || u2Blocked || u1Doc?.isBanned || u2Doc?.isBanned) {
          continue;
        }

        const matchedSocketIds = new Set([u1.socketId, u2.socketId]);
        matchmakingQueue = matchmakingQueue.filter((entry) => !matchedSocketIds.has(entry.socketId));

        const roomId = `stranger_room_${Math.random().toString(36).substring(2, 10)}`;

        activeMatches.set(roomId, {
          user1: { username: u1.username, socketId: u1.socketId },
          user2: { username: u2.username, socketId: u2.socketId },
          messages: [],
          lastActivity: Date.now()
        });

        Match.create({
          user1: u1.username,
          user2: u2.username,
          roomId
        }).catch((err) => console.error(err));

        const socket1 = io.sockets.sockets.get(u1.socketId);
        const socket2 = io.sockets.sockets.get(u2.socketId);

        if (socket1) socket1.join(roomId);
        if (socket2) socket2.join(roomId);

        const common = u1.interests.filter((x) => u2.interests.includes(x));

        const matchMode = u1.randomMode || u2.randomMode ? 'random' : 'smart';

        io.to(u1.socketId).emit('matched', {
          strangerName: u2.username,
          roomId,
          commonInterests: common,
          strangerMood: u2.mood,
          initiator: true,
          matchMode
        });

        io.to(u2.socketId).emit('matched', {
          strangerName: u1.username,
          roomId,
          commonInterests: common,
          strangerMood: u1.mood,
          initiator: false,
          matchMode
        });

        console.log(`🔗 [Matchmaker] Connected ${u1.username} & ${u2.username} (${matchMode}) inside room: ${roomId}`);
        break;
      }
    }
  } finally {
    matchingInProgress = false;
    if (matchmakingQueue.length >= 2) {
      setImmediate(() => {
        tryMatchUsers().catch(console.error);
      });
    }
  }
}

// Perform skipped/next user re-allocation
function handleSkip(roomId, skippingSocketId) {
  const match = activeMatches.get(roomId);
  if (!match) return;

  const partner = match.user1.socketId === skippingSocketId ? match.user2 : match.user1;
  const skipper = match.user1.socketId === skippingSocketId ? match.user1 : match.user2;

  const io = global.ioPointer;
  if (io) {
    io.to(partner.socketId).emit('stranger-skipped', { message: 'Stranger skipped the chat.' });
    const s1 = io.sockets.sockets.get(skipper.socketId);
    const s2 = io.sockets.sockets.get(partner.socketId);
    if (s1) s1.leave(roomId);
    if (s2) s2.leave(roomId);
  }

  activeMatches.delete(roomId);
  console.log(`🛑 Match room ${roomId} closed due to SKIP command`);
}

function sweepInactiveSessions() {
  const now = Date.now();
  const io = global.ioPointer;

  for (const [roomId, match] of activeMatches.entries()) {
    if (now - (match.lastActivity || now) > MATCH_INACTIVITY_TIMEOUT_MS) {
      endMatchSession(roomId, 'Session ended because the chat was inactive for too long.', 'session-timeout');
    }
  }

  matchmakingQueue = matchmakingQueue.filter((entry) => {
    const isExpired = now - entry.joinedAt > QUEUE_INACTIVITY_TIMEOUT_MS;
    if (isExpired && io) {
      io.to(entry.socketId).emit('queue-timeout', {
        message: 'Your matchmaking queue session timed out because of inactivity.'
      });
    }
    return !isExpired;
  });
}

setInterval(() => {
  tryMatchUsers().catch(console.error);
  sweepInactiveSessions();
}, 2000);

module.exports = { handleSocket };
