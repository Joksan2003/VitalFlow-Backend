// src/models/Favorite.js
const FavoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', index: true },
  recipeId: { type: mongoose.Types.ObjectId, ref: 'Recipe', index: true },
}, { timestamps: true });

FavoriteSchema.index({ userId: 1, recipeId: 1 }, { unique: true });