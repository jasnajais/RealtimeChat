require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { connectDB, getDbStatus } = require('./backend/config/db');
const { sendError } = require('./backend/utils/httpResponses');

const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:8080", 
      "http://127.0.0.1:8080",
      "https://realtime-chat-w7a3.vercel.app/",
    "https://realtimechat-kz1j.onrender.com",
      /\.netlify\.app$/,
      /\.vercel\.app$/,
      /\.onrender\.com$/,
      /\.up\.railway\.app$/
    ];

function isOriginAllowed(origin) {
  if (!origin) return true;

  return ALLOWED_ORIGINS.some((allowed) => {
    if (allowed instanceof RegExp) {
      return allowed.test(origin);
    }
    return allowed === origin;
  });
}

// Initialize Express App
const app = express();
const server = http.createServer(app);

// CORS Middlewares
const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API REST Routes
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/stats', require('./backend/routes/stats'));
app.use('/api/mod', require('./backend/routes/mod'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    database: getDbStatus() ? 'mongodb' : 'in-memory-fallback',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend assets in production build
const clientBuildPath = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientBuildPath));

app.use((req, res, next) => {
  // If request hits API route that doesn't exist, return 404
  if (req.path.startsWith('/api/')) {
    return sendError(res, 404, 'API route not found.');
  }
  // Otherwise, serve index.html for React routing
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Vite frontend build is missing. Run npm run build in /client.');
    }
  });
});


// Setup Socket.IO Server
const io = new Server(server, {
  cors: corsOptions,
  allowEIO3: true,
  maxHttpBufferSize: 1e6,
  pingTimeout: 60000,
  pingInterval: 25000,
  compression: true
});

// Link global reference for sockets
global.ioPointer = io;

// Import & bind Socket.IO routes
const { handleSocket } = require('./backend/sockets/chatSocket');
handleSocket(io);

// Graceful shut down
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  
  io.emit("server-shutdown", {
    message: "Server is shutting down. Please reconnect in a moment.",
    timestamp: new Date().toISOString()
  });
  
  setTimeout(() => {
    io.close(() => {
      console.log('✅ Socket.IO server closed');
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 0) {
        mongoose.connection.close().then(() => {
          console.log('✅ Mongoose connection closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });
  }, 1000);
});

// Connect to Database (Mongoose / In-Memory Fallback), then start server
async function startServer() {
  await connectDB();

  let currentPort = Number(PORT);
  const MAX_PORT_ATTEMPTS = 10;

  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
    try {
      const started = await new Promise((resolve, reject) => {
        server.once('error', (error) => {
          server.removeAllListeners('listening');
          if (error.code === 'EADDRINUSE') {
            console.warn(`⚠️ Port ${currentPort} is already in use, trying ${currentPort + 1}...`);
            currentPort++;
            resolve(false);
          } else {
            reject(error);
          }
        });

        server.once('listening', () => {
          server.removeAllListeners('error');
          resolve(true);
        });

        server.listen(currentPort);
      });

      if (started) {
        console.log('🚀 [Server] Socket.IO & Express Starting...');
        console.log(`   ├─ Port: ${currentPort}`);
        console.log(`   ├─ Database Status: ${getDbStatus() ? 'MongoDB' : 'In-Memory fallback'}`);
        console.log(`   └─ Listening at http://localhost:${currentPort}`);
        return;
      }
    } catch (err) {
      console.error('❌ Server failed to start:', err.message);
      process.exit(1);
    }
  }

  console.error(`❌ Could not find an available port after ${MAX_PORT_ATTEMPTS} attempts.`);
  process.exit(1);
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
