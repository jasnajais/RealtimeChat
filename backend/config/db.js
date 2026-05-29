const mongoose = require('mongoose');

let isConnected = false;

// Global in-memory storage for fallback mode
const mockStore = {
  users: new Map(),
  matches: [],
  reports: []
};

async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.log('⚠️ [Database] MONGODB_URI not specified. Running with IN-MEMORY fallback store.');
    isConnected = false;
    return false;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ [Database] Connected to MongoDB.');
    isConnected = true;
    return true;
  } catch (error) {
    console.error('❌ [Database] Connection error:', error.message);
    console.log('⚠️ [Database] Running with IN-MEMORY fallback store.');
    isConnected = false;
    return false;
  }
}

function getDbStatus() {
  return isConnected;
}

module.exports = { connectDB, getDbStatus, mockStore };
