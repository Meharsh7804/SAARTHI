const mongoose = require('mongoose');

const rideHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  pickup: {
    type: String,
    required: true
  },
  destination: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    default: 1
  },
  lastBookedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('rideHistory', rideHistorySchema);
