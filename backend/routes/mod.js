const express = require('express');
const { User } = require('../models/User');
const { Report } = require('../models/Report');
const { authMiddleware } = require('../middleware/auth');
const { sendError, sendServerError } = require('../utils/httpResponses');

const router = express.Router();

// Role checking helper
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return sendError(res, 403, 'Forbidden. Admin privileges required.');
  }
}

// Fetch all moderation reports
router.get('/reports', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const list = await Report.find();
    return res.json(list);
  } catch (error) {
    return sendServerError(res, 'Error fetching reports:', error);
  }
});

// Resolve a report flag
router.post('/reports/:id/resolve', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const reportObj = await Report.findByIdAndUpdate(id, { $set: { resolved: true } });
    if (!reportObj) {
      return sendError(res, 404, 'Report flag not found.');
    }
    return res.json({ message: 'Report marked as resolved successfully.' });
  } catch (error) {
    return sendServerError(res, 'Error resolving report:', error);
  }
});

// Blacklist/ban a nickname
router.post('/ban', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return sendError(res, 400, 'Username is required to perform block action.');
    }
    
    const userObj = await User.findOneAndUpdate(
      { username },
      { $set: { isBanned: true } }
    );
    
    if (!userObj) {
      // Create user record to ban them in case they haven't registered
      await User.create({ username, isBanned: true });
    }
    
    return res.json({ message: `Successfully blacklisted user: ${username}` });
  } catch (error) {
    return sendServerError(res, 'Error banning user:', error);
  }
});

// Lift a ban
router.post('/unban', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return sendError(res, 400, 'Username is required to perform unblock action.');
    }
    
    const userObj = await User.findOneAndUpdate(
      { username },
      { $set: { isBanned: false } }
    );
          
    if (!userObj) {
      return sendError(res, 404, 'User not found.');
    }
    
    return res.json({ message: `Successfully unbanned user: ${username}` });
  } catch (error) {
    return sendServerError(res, 'Error unbanning user:', error);
  }
});

// Fetch all registered users list
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = await User.find();
    return res.json(users);
  } catch (error) {
    return sendServerError(res, 'Error fetching admin users list:', error);
  }
});

module.exports = router;











