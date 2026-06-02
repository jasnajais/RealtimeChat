const mongoose = require('mongoose');
const { getDbStatus, mockStore } = require('../config/db');

const MatchSchema = new mongoose.Schema({
  user1: { type: String, required: true },
  user2: { type: String, required: true },
  roomId: { type: String, required: true },
  matchedAt: { type: Date, default: Date.now }
});

const MongooseMatchModel = mongoose.models.Match || mongoose.model('Match', MatchSchema);

const MockMatchModel = {
  async create(data) {
    const matchObj = {
      _id: 'mock_match_' + Math.random().toString(36).substring(2, 9),
      user1: data.user1,
      user2: data.user2,
      roomId: data.roomId,
      matchedAt: new Date()
    };
    mockStore.matches.push(matchObj);
    return matchObj;
  },
  async find(query = {}) {
    let list = mockStore.matches;
    if (query.$or) {
      const [q1, q2] = query.$or;
      list = list.filter(m => 
        (m.user1 === q1.user1 || m.user2 === q1.user2) || 
        (m.user1 === q2.user1 || m.user2 === q2.user2)
      );
    }
    // Simple filter sorted by date descending
    return list.slice().sort((a, b) => b.matchedAt - a.matchedAt);
  }
};

module.exports = {
  Match: new Proxy({}, {
    get(target, prop) {
      const activeModel = getDbStatus() ? MongooseMatchModel : MockMatchModel;
      const value = activeModel[prop];
      return typeof value === 'function' ? value.bind(activeModel) : value;
    }
  })
};



