
const { Server } = require("socket.io");
const http = require("http");

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : [
      "http://localhost:8080", 
      "http://127.0.0.1:8080",
      "https://glowing-duckanoo-1193ca.netlify.app",
      /\.netlify\.app$/,
      /\.onrender\.com$/,
      /\.up\.railway\.app$/
    ];

const server = http.createServer((req, res) => {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', 'https://glowing-duckanoo-1193ca.netlify.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Socket.IO server is running');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const io = new Server(server, {
  cors: {
    origin: [
      "https://glowing-duckanoo-1193ca.netlify.app",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      /\.netlify\.app$/,
      /\.onrender\.com$/
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  allowEIO3: true,
  maxHttpBufferSize: 1e6,
  pingTimeout: 60000,
  pingInterval: 25000,
  compression: true
});

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 1000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(socketId) {
  const now = Date.now();
  const userLimits = rateLimitMap.get(socketId) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  if (now > userLimits.resetTime) {
    userLimits.count = 1;
    userLimits.resetTime = now + RATE_LIMIT_WINDOW;
  } else {
    userLimits.count++;
  }
  
  rateLimitMap.set(socketId, userLimits);
  return userLimits.count <= RATE_LIMIT_MAX;
}

let connectionCount = 0;
const activeUsers = new Set();

io.on("connection", (socket) => {
  connectionCount++;
  activeUsers.add(socket.id);
  
  console.log(`🟢 New connection established`);
  console.log(`   ├─ Socket ID: ${socket.id}`);
  console.log(`   ├─ IP Address: ${socket.handshake.address}`);
  console.log(`   └─ Active connections: ${connectionCount}`);
  
  socket.emit("connection-status", {
    status: "connected",
    message: "Welcome! You're successfully connected to the server.",
    timestamp: new Date().toISOString(),
    activeUsers: activeUsers.size
  });
  
  socket.broadcast.emit("user-joined", {
    message: "A new user joined the chat",
    activeUsers: activeUsers.size,
    timestamp: new Date().toISOString()
  });

  socket.on("send-message", (data) => {
    try {
      if (!checkRateLimit(socket.id)) {
        socket.emit("error", { message: "Rate limit exceeded. Please slow down." });
        return;
      }
      
      if (!data || typeof data !== 'object') {
        socket.emit("error", { message: "Invalid message format" });
        return;
      }
      
      const { message, username } = data;
      
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        socket.emit("error", { message: "Message cannot be empty" });
        return;
      }
      
      const sanitizedMessage = message
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .trim()
        .substring(0, 1000);
      
      const messageData = {
        message: sanitizedMessage,
        username: username || "Anonymous",
        timestamp: new Date().toISOString(),
        senderId: socket.id
      };
      
      console.log(`📨 Message from ${messageData.username} (${socket.id}): ${sanitizedMessage}`);
      
      socket.broadcast.emit("receive-message", messageData);
      
      socket.emit("message-sent", {
        status: "delivered",
        timestamp: messageData.timestamp
      });
      
    } catch (error) {
      console.error(`❌ Error handling message from ${socket.id}:`, error);
      socket.emit("error", { message: "Failed to process message" });
    }
  });
  
  socket.on("typing", (data) => {
    socket.broadcast.emit("user-typing", {
      username: data.username || "Someone",
      isTyping: data.isTyping,
      timestamp: new Date().toISOString()
    });
  });
  
  socket.on("disconnect", (reason) => {
    connectionCount--;
    activeUsers.delete(socket.id);
    rateLimitMap.delete(socket.id);
    
    console.log(`🔴 User disconnected`);
    console.log(`   ├─ Socket ID: ${socket.id}`);
    console.log(`   ├─ Reason: ${reason}`);
    console.log(`   └─ Remaining connections: ${connectionCount}`);
    
    socket.broadcast.emit("user-left", {
      message: "A user left the chat",
      activeUsers: activeUsers.size,
      timestamp: new Date().toISOString()
    });
  });
  
  socket.on("error", (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });
});

io.engine.on("connection_error", (err) => {
  console.error("❌ Connection error:", err.req);
  console.error("   Error code:", err.code);
  console.error("   Error message:", err.message);
  console.error("   Error context:", err.context);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  
  io.emit("server-shutdown", {
    message: "Server is shutting down. Please reconnect in a moment.",
    timestamp: new Date().toISOString()
  });
  
  setTimeout(() => {
    io.close(() => {
      console.log('✅ Socket.IO server closed');
      process.exit(0);
    });
  }, 1000);
});

server.listen(PORT, () => {
  console.log('🚀 Socket.IO Server Starting...');
  console.log(`   ├─ Port: ${PORT}`);
  console.log(`   ├─ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   ├─ Allowed Origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`   └─ Server ready at http://localhost:${PORT}`);
  console.log('📡 Waiting for connections...\n');
});
