// src/models/MealPlan.js
const MealPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  name: String,
  description: String,
  startDate: Date,
  days: [{
    dayNumber: Number,
    meals: [{ mealType: String, recipeId: { type: mongoose.Types.ObjectId, ref: 'Recipe' }, portions: Number }]
  }],
  goals: { caloriesPerDay: Number, protein: Number, carbs: Number, fat: Number },
  generatedBy: { type: String }, // 'ai' or 'nutri'
  status: { type: String, enum: ['active','completed','archived'], default: 'active' }
}, { timestamps: true });