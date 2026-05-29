const HTTP_MESSAGES = {
  BAD_REQUEST: 'Bad request.',
  UNAUTHORIZED: 'Authentication failed.',
  FORBIDDEN: 'Forbidden.',
  NOT_FOUND: 'Resource not found.',
  INTERNAL_SERVER_ERROR: 'Internal server error'
};

function sendError(res, status, message) {
  return res.status(status).json({ message });
}

function sendServerError(res, logMessage, error) {
  console.error(logMessage, error);
  return sendError(res, 500, HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
}

module.exports = {
  HTTP_MESSAGES,
  sendError,
  sendServerError
};
