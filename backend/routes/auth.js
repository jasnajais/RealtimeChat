const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');
const { sendError } = require('../utils/httpResponses');
const { generateTempUsername } = require('../utils/usernames');
const { updateDailyStreak, getUtcDayKey } = require('../utils/gamification');

const router = express.Router();
router.post('/register', async (req, res) => {
  try {
    let { username, adminCode } = req.body;
    let chosenUsername = username ? username.trim() : '';

    if (!chosenUsername) {
      // Loop a few times to guarantee uniqueness
      let attempts = 0;
      let existing = null;
      do {
        chosenUsername = generateTempUsername();
        existing = await User.findOne({ username: chosenUsername });
        attempts++;
      } while (existing && attempts < 10);

      if (existing) {
        return sendError(res, 409, 'Could not generate a unique username. Please try again.');
      }
    } else {
      // Username validation
      if (chosenUsername.length < 3 || chosenUsername.length > 25) {
        return sendError(res, 400, 'Username must be between 3 and 25 characters.');
      }
      if (!/^[a-zA-Z0-9_]+$/.test(chosenUsername)) {
        return sendError(res, 400, 'Username can only contain letters, numbers, and underscores.');
      }
      
      const existing = await User.findOne({ username: chosenUsername });
      if (existing) {
        if (existing.isBanned) {
          return sendError(res, 403, 'This nickname has been blacklisted for rules violations.');
        }

        updateDailyStreak(existing);
        await existing.save();
        
        // Log them back in under this username for convenience in testing!
        const token = jwt.sign({ username: existing.username, role: existing.role }, JWT_SECRET);
        return res.status(200).json({
          token,
          username: existing.username,
          role: existing.role,
          xp: existing.xp,
          level: existing.level,
          badges: existing.badges,
          streak: existing.streak,
          streakLastDate: existing.streakLastDate
        });
      }
    }

    // Role assignment (check development passcode for admin demo)
    let role = 'user';
    if (adminCode === 'neonadmin1337' || adminCode === 'admin') {
      role = 'admin';
    }

    // Create new profile record
    const newUser = await User.create({
      username: chosenUsername,
      role,
      xp: 10, // starting bonus
      level: 1,
      streak: 1,
      streakLastDate: getUtcDayKey(),
      badges: ['Newcomer']
    });

    const token = jwt.sign({ username: newUser.username, role: newUser.role }, JWT_SECRET);

    return res.status(201).json({
      token,
      username: newUser.username,
      role: newUser.role,
      xp: newUser.xp,
      level: newUser.level,
      badges: newUser.badges,
      streak: newUser.streak,
      streakLastDate: newUser.streakLastDate
    });

  } catch (error) {
    console.error('Registration error:', error);
    return sendError(res, 500, 'Failed to complete registration process');
  }
});

module.exports = router;
