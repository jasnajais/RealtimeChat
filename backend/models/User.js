const mongoose = require('mongoose');
const { getDbStatus, mockStore } = require('../config/db');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  streak: { type: Number, default: 1 },
  streakLastDate: { type: String, default: null },
  lastActive: { type: Date, default: Date.now },
  badges: [{ type: String }],
  blockedUsers: [{ type: String }],
  moderationScore: { type: Number, default: 0 },
  role: { type: String, default: 'user' },
  isBanned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const MongooseUserModel = mongoose.models.User || mongoose.model('User', UserSchema);

// In-Memory Fallback Model
const MockUserModel = {
  async findOne(query) {
    const { username } = query;
    return mockStore.users.get(username) || null;
  },
  async find(query = {}) {
    let list = Array.from(mockStore.users.values());
    if (query.isBanned !== undefined) {
      list = list.filter((u) => Boolean(u.isBanned) === query.isBanned);
    }
    return list;
  },
  async create(data) {
    const userObj = {
      _id: 'mock_usr_' + Math.random().toString(36).substring(2, 9),
      username: data.username,
      xp: data.xp || 0,
      level: data.level || 1,
      streak: data.streak || 1,
      streakLastDate: data.streakLastDate || null,
      lastActive: data.lastActive || new Date(),
      badges: data.badges || [],
      blockedUsers: data.blockedUsers || [],
      moderationScore: data.moderationScore || 0,
      role: data.role || 'user',
      isBanned: data.isBanned || false,
      createdAt: new Date(),
      async save() {
        mockStore.users.set(this.username, this);
        return this;
      }
    };
    mockStore.users.set(userObj.username, userObj);
    return userObj;
  },
  async findOneAndUpdate(query, update, options = {}) {
    const { username } = query;
    const user = mockStore.users.get(username);
    if (!user) return null;
    
    if (update.$set) {
      Object.assign(user, update.$set);
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        user[k] = (user[k] || 0) + v;
      }
    }
    if (update.$set?.streakLastDate !== undefined) {
      user.streakLastDate = update.$set.streakLastDate;
    }
    user.lastActive = new Date();
    mockStore.users.set(username, user);
    return user;
  }
};

module.exports = {
  User: new Proxy({}, {
    get(target, prop) {
      const activeModel = getDbStatus() ? MongooseUserModel : MockUserModel;
      const value = activeModel[prop];
      return typeof value === 'function' ? value.bind(activeModel) : value;
    }
  })
};
