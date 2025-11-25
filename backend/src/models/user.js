// src/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user','nutriologo','admin'], default: 'user' },
  isVerified: { type: Boolean, default: false },
  avatarUrl: { type: String, default: '' },
  bio: { type: String, default: '' },

  // --- NUEVOS CAMPOS PARA ONBOARDING Y PERSONALIZACIÓN ---
  birthDate: { type: Date }, // para calcular edad dinámicamente
  gender: { type: String, enum: ['male','female','other','prefer_not'], default: 'prefer_not' },

  heightCm: { type: Number, default: null }, // cm
  weightKg: { type: Number, default: null }, // kg
  activityLevel: {
    type: String,
    enum: ['sedentary','light','moderate','active','very_active'],
    default: 'moderate'
  },

  // Dietas / alergias / preferencias
  diets: { type: [String], default: [] },        // ej ['vegetariana','vegana']
  allergies: { type: [String], default: [] },    // ej ['nueces','gluten']
  dislikes: { type: [String], default: [] },     // alimentos no deseados
  favouriteIngredients: { type: [String], default: [] },

  // Objetivos
  goal: { type: String, enum: ['perder_peso','mantener','ganar_masa','mejorar_salud'], default: 'mantener' },
  targetWeightKg: { type: Number, default: null },

  // Relación y metadatos
  nutriologoAssigned: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  onboardingCompleted: { type: Boolean, default: false },
  preferencesUpdatedAt: { type: Date, default: Date.now },

  // configuración y privacidad
  locale: { type: String, default: 'es-MX' },
  units: { type: String, enum: ['metric','imperial'], default: 'metric' },

  // tracking
  lastSeen: { type: Date, default: Date.now },

  medicalNotes: { type: String, default: '' },

  // Retos
  activeChallenges: [{
    challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge' },
    joinedAt: { type: Date, default: Date.now },
    streak: { type: Number, default: 0 },
    lastMarkedAt: { type: Date, default: null },
    completedDays: { type: Number, default: 0 },
    status: { type: String, enum: ['in_progress','failed','completed'], default: 'in_progress' }
  }],

  completedChallenges: [{
    challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge' },
    finishedAt: { type: Date, default: Date.now },
    totalPoints: { type: Number, default: 0 }
  }],

  points: { type: Number, default: 0 }, // acumulados por usuario
  // 👇 NUEVO: favoritos
  favoriteRecipes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe'
  }],
  // 👇 NUEVOS CAMPOS PARA RESET PASSWORD
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null }

},
{
  timestamps: true // crea createdAt y updatedAt automáticamente
});

// virtual para edad (si birthDate existe)
userSchema.virtual('age').get(function() {
  if (!this.birthDate) return null;
  const diff = Date.now() - this.birthDate.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
});

// mantener updatedAt si se modifica manualmente
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// índices recomendados
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ 'activeChallenges.challengeId': 1 });

module.exports = mongoose.model('User', userSchema);