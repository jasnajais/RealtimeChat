const mongoose = require('mongoose');
const { getDbStatus, mockStore } = require('../config/db');

const ReportSchema = new mongoose.Schema({
  reportedUser: { type: String, required: true },
  reporter: { type: String, required: true },
  reason: { type: String, required: true },
  messages: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false }
});

const MongooseReportModel = mongoose.models.Report || mongoose.model('Report', ReportSchema);

const MockReportModel = {
  async create(data) {
    const reportObj = {
      _id: 'mock_rep_' + Math.random().toString(36).substring(2, 9),
      reportedUser: data.reportedUser,
      reporter: data.reporter,
      reason: data.reason,
      messages: data.messages || [],
      createdAt: new Date(),
      resolved: false,
      async save() {
        const idx = mockStore.reports.findIndex(r => r._id === this._id);
        if (idx !== -1) {
          mockStore.reports[idx] = this;
        } else {
          mockStore.reports.push(this);
        }
        return this;
      }
    };
    mockStore.reports.push(reportObj);
    return reportObj;
  },
  async find(query = {}) {
    let list = mockStore.reports;
    if (query.resolved !== undefined) {
      list = list.filter(r => r.resolved === query.resolved);
    }
    return list.slice().sort((a, b) => b.createdAt - a.createdAt);
  },
  async findByIdAndUpdate(id, update, options = {}) {
    const report = mockStore.reports.find(r => r._id === id);
    if (!report) return null;
    if (update.$set) {
      Object.assign(report, update.$set);
    }
    return report;
  }
};

module.exports = {
  Report: new Proxy({}, {
    get(target, prop) {
      const activeModel = getDbStatus() ? MongooseReportModel : MockReportModel;
      const value = activeModel[prop];
      return typeof value === 'function' ? value.bind(activeModel) : value;
    }
  })
};
