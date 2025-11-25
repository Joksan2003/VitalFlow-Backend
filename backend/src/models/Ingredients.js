// src/models/Ingredient.js
const mongoose = require('mongoose');

const IngredientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  aliases: [String],
  localNames: [{ locale: String, name: String }], // para adaptaciones locales
  unitDefault: String, // ej "g", "ml", "pieza"
  nutrition: {
    calories: Number,
    protein_g: Number,
    carbs_g: Number,
    fat_g: Number,
    fiber_g: Number,
  },
  tags: [String],
  createdBy: { type: mongoose.Types.ObjectId, ref: 'User' }, // opcional
}, { timestamps: true });

module.exports = mongoose.model('Ingredient', IngredientSchema);