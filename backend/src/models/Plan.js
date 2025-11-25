// backend/src/models/Plan.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const IngredientSchema = new Schema({
  name: { type: String, required: true },
  quantity: { type: Schema.Types.Mixed, default: null }, // puede ser número, string, null
  unit: { type: String, default: '' },
}, { _id: false });

const MealSchema = new Schema({
  nombre: { type: String, required: true },                // Desayuno / Almuerzo / Cena
  recetaId: { type: Schema.Types.ObjectId, ref: 'Recipe', default: null },
  recetaTitle: { type: String, default: '' },              // título sugerido
  receta: { type: Schema.Types.Mixed, default: null },     // si IA devuelve objeto completo, lo guardamos aquí (sin normalizar)
  calorias_aprox: { type: Number, default: 0 },
  notes: { type: String, default: '' }
}, { _id: false });

const DaySchema = new Schema({
  dia: { type: Number, required: true },
  comidas: { type: [MealSchema], default: [] }
}, { _id: false });

const PlanSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  nombre_persona: { type: String, default: '' },
  meta: {
    objetivo: { type: String, default: '' },
    dieta: { type: String, default: '' },
    calorias_diarias_recomendadas: { type: Number, default: 0 },
    alergias: { type: [String], default: [] }
  },
  dias: { type: [DaySchema], default: [] },
  suggestedRecipes: [{ type: Schema.Types.ObjectId, ref: 'Recipe' }],
  source: { type: String, default: 'ai' }, // 'ai' | 'human'
  status: { type: String, enum: ['pending_review','approved','rejected','active'], default: 'pending_review' },
  nutriReviewer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reviewerNotes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Plan', PlanSchema);