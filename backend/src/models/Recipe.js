// backend/src/models/Recipe.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const IngredientSchema = new Schema({
  name: { type: String, required: true },
  quantity: { type: Number },
  unit: { type: String }
}, { _id: false });

const RecipeSchema = new Schema({
  title: { type: String, required: true },
  summary: { type: String },
  description: { type: String },
  kcal: { type: Number },
  prepTimeMin: { type: Number },
  servings: { type: Number },
  tags: [{ type: String }],
  diets: [{ type: String }],
  categories: [{ type: String }],
  imageUrl: { type: String, default: "" },
  imagePrompt: { type: String },
  ingredients: [IngredientSchema],
  steps: [{ type: String }],
  // Campos para revisión de nutriólogo
  nutriReviewer: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewerNotes: { type: String, default: '' },
  source: { type: String, enum: ['ai','human'], default: 'ai' },
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['draft','pending','approved','rejected'], default: 'draft' },
  local: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  // 👇 NUEVO
  favoritesCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.models.Recipe || mongoose.model('Recipe', RecipeSchema);