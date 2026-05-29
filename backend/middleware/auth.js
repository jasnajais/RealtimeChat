const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/httpResponses');

const JWT_SECRET = process.env.JWT_SECRET || 'neon_stranger_chat_secret_1337';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Authentication failed. Token missing.');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { username, role }
    next();
  } catch (error) {
    return sendError(res, 401, 'Authentication failed. Invalid or expired token.');
  }
}

module.exports = { authMiddleware, JWT_SECRET };
