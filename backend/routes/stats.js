const express = require('express');
const { User } = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { sendError, sendServerError } = require('../utils/httpResponses');

const router = express.Router();

// Get top players based on XP, streak, and level
router.get('/leaderboard', async (req, res) => {
  try {
    const { username: currentUsername } = req.query;
    const allUsers = await User.find({ isBanned: false });
    const sorted = allUsers
      .sort((a, b) => b.xp - a.xp)
      .map((u) => ({
        username: u.username,
        xp: u.xp,
        level: u.level,
        badges: u.badges,
        streak: u.streak || 1,
        streakLastDate: u.streakLastDate || null,
        lastActive: u.lastActive
      }))
      .sort((a, b) => {
        if (b.xp !== a.xp) return b.xp - a.xp;
        if (b.level !== a.level) return b.level - a.level;
        if (b.streak !== a.streak) return b.streak - a.streak;
        return new Date(b.lastActive || 0) - new Date(a.lastActive || 0);
      })
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    const topEntries = sorted.slice(0, 20);

    const currentUser = currentUsername
      ? sorted.find((entry) => entry.username === currentUsername) || null
      : null;

    return res.json({
      entries: topEntries,
      currentUser
    });
  } catch (error) {
    return sendServerError(res, 'Error fetching leaderboard:', error);
  }
});

// Fetch detailed user profile stats
router.get('/profile/:username', authMiddleware, async (req, res) => {
  try {
    const { username } = req.params;
    const userObj = await User.findOne({ username });
    if (!userObj) {
      return sendError(res, 404, 'User profile not found.');
    }
    
    // XP threshold calculations: e.g. next level is level * 100 XP
    const nextLevelXp = userObj.level * 100;
    const prevLevelXp = (userObj.level - 1) * 100;
    const currentProgressXp = userObj.xp - prevLevelXp;
    const levelPercentage = Math.min(100, Math.max(0, (currentProgressXp / (nextLevelXp - prevLevelXp)) * 100));

    return res.json({
      username: userObj.username,
      xp: userObj.xp,
      level: userObj.level,
      streak: userObj.streak,
      streakLastDate: userObj.streakLastDate || null,
      badges: userObj.badges,
      role: userObj.role,
      moderationScore: userObj.moderationScore || 0,
      isBanned: Boolean(userObj.isBanned),
      blockedCount: Array.isArray(userObj.blockedUsers) ? userObj.blockedUsers.length : 0,
      lastActive: userObj.lastActive,
      levelProgress: Math.round(levelPercentage),
      xpNeeded: nextLevelXp
    });
  } catch (error) {
    return sendServerError(res, 'Error fetching profile:', error);
  }
});

module.exports = router;
