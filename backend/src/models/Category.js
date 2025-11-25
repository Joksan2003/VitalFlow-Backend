// src/models/Category.js
const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: String,
  description: String
}, { timestamps: true });