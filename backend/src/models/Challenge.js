const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  durationDays: { type: Number, default: 7 }, // duración del reto
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // nutriologo
  isActive: { type: Boolean, default: true },
  rewardPoints: { type: Number, default: 10 }, // puntos por completar
  tags: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

challengeSchema.index({ createdBy: 1, isActive: 1 });
module.exports = mongoose.model('Challenge', challengeSchema);