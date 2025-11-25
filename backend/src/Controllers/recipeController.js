// backend/src/controllers/recipeController.js
const mongoose = require('mongoose');
const Recipe = require('../models/Recipe');

// ---------- Helpers compartidos ----------
function parseMaybeJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function buildInstructionsHtml(stepsArr) {
  if (!Array.isArray(stepsArr) || stepsArr.length === 0) return '';
  return `<ol>${stepsArr.map((s) => `<li>${s}</li>`).join('')}</ol>`;
}

// ========== LISTADO PÚBLICO ==========
exports.listRecipes = async (req, res, next) => {
  try {
    const {
      q, category, diet, maxKcal, local, page = 1, limit = 12, sort
    } = req.query;

    const pageNum = Math.max(1, parseInt(page || 1, 10));
    const lim = Math.max(1, Math.min(100, parseInt(limit || 12, 10)));

    const filter = { status: 'approved' };

    if (typeof local !== 'undefined') {
      if (local === 'true' || local === '1') filter.local = true;
      else if (local === 'false' || local === '0') filter.local = false;
    }

    if (category) filter.categories = { $in: [category] };
    if (diet) filter.diets = { $in: [diet] };
    if (maxKcal) {
      const k = Number(maxKcal);
      if (!Number.isNaN(k)) filter.kcal = { $lte: k };
    }
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { title: { $regex: regex } },
        { description: { $regex: regex } },
        { 'ingredients.name': { $regex: regex } }
      ];
    }

    let sortObj = { createdAt: -1 };
    if (sort === 'kcal_asc') sortObj = { kcal: 1 };
    if (sort === 'kcal_desc') sortObj = { kcal: -1 };
    if (sort === 'likes') sortObj = { likes: -1 };

    const total = await Recipe.countDocuments(filter);
    const data = await Recipe.find(filter)
      .sort(sortObj)
      .skip((pageNum - 1) * lim)
      .limit(lim)
      .lean();

    res.json({
      ok: true,
      data,
      total,
      page: pageNum,
      limit: lim
    });
  } catch (err) {
    next(err);
  }
};

// ========== LISTADO PENDIENTE (NUTRI / ADMIN) ==========
exports.listPendingRecipes = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, sort } = req.query;
    const pageNum = Math.max(1, parseInt(page || 1, 10));
    const lim = Math.max(1, Math.min(200, parseInt(limit || 12, 10)));

    const filter = { status: { $ne: 'approved' } }; // pending / rejected / draft / etc.

    let sortObj = { createdAt: -1 };
    if (sort === 'kcal_asc') sortObj = { kcal: 1 };
    if (sort === 'kcal_desc') sortObj = { kcal: -1 };

    const total = await Recipe.countDocuments(filter);
    const data = await Recipe.find(filter)
      .sort(sortObj)
      .skip((pageNum - 1) * lim)
      .limit(lim)
      .lean();

    res.json({ ok: true, data, total, page: pageNum, limit: lim });
  } catch (err) {
    next(err);
  }
};

// ========== RECETAS DEL USUARIO AUTENTICADO ==========
exports.getMyRecipes = async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?._id || req.user?.id;
    if (!userId) {
      console.warn('getMyRecipes: req.user no contiene uid/_id/id ->', req.user);
      return res.status(401).json({ ok: false, msg: 'Usuario no autenticado' });
    }

    const recipes = await Recipe.find({
      $or: [
        { userId: userId },
        { createdBy: userId },
        { author: userId }
      ]
    }).sort({ createdAt: -1 }).lean();

    return res.json({ ok: true, recipes });
  } catch (err) {
    console.error('Error obteniendo recetas del usuario:', err);
    return res.status(500).json({ ok: false, msg: 'Error obteniendo recetas del usuario' });
  }
};

// ========== FAVORITOS ==========
exports.getMyFavoriteRecipes = async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ ok: false, msg: 'Usuario no autenticado' });
    }

    const User = require('../models/user');
    const user = await User.findById(userId).populate({
      path: 'favoriteRecipes',
      select: 'title imageUrl kcal diets categories tags favoritesCount status'
    }).lean();

    if (!user) {
      return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
    }

    return res.json({
      ok: true,
      data: user.favoriteRecipes || []
    });
  } catch (err) {
    console.error('getMyFavoriteRecipes error:', err);
    return res.status(500).json({ ok: false, msg: 'Error obteniendo favoritos' });
  }
};

exports.addFavorite = async (req, res) => {
  try {
    const userId = req.user?.uid;
    const recipeId = req.params.id;

    if (!userId) {
      return res.status(401).json({ ok: false, msg: 'Usuario no autenticado' });
    }
    if (!mongoose.Types.ObjectId.isValid(recipeId)) {
      return res.status(400).json({ ok: false, msg: 'ID de receta inválido' });
    }

    const User = require('../models/user');

    const updateUser = await User.updateOne(
      { _id: userId, favoriteRecipes: { $ne: recipeId } },
      { $addToSet: { favoriteRecipes: recipeId } }
    );

    if (updateUser.modifiedCount > 0) {
      await Recipe.updateOne(
        { _id: recipeId },
        { $inc: { favoritesCount: 1 } }
      );
    }

    return res.json({ ok: true, msg: 'Agregada a favoritos' });
  } catch (err) {
    console.error('addFavorite error:', err);
    return res.status(500).json({ ok: false, msg: 'Error agregando a favoritos' });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const userId = req.user?.uid;
    const recipeId = req.params.id;

    if (!userId) {
      return res.status(401).json({ ok: false, msg: 'Usuario no autenticado' });
    }
    if (!mongoose.Types.ObjectId.isValid(recipeId)) {
      return res.status(400).json({ ok: false, msg: 'ID de receta inválido' });
    }

    const User = require('../models/user');

    const updateUser = await User.updateOne(
      { _id: userId, favoriteRecipes: recipeId },
      { $pull: { favoriteRecipes: recipeId } }
    );

    if (updateUser.modifiedCount > 0) {
      await Recipe.updateOne(
        { _id: recipeId, favoritesCount: { $gt: 0 } },
        { $inc: { favoritesCount: -1 } }
      );
    }

    return res.json({ ok: true, msg: 'Quitada de favoritos' });
  } catch (err) {
    console.error('removeFavorite error:', err);
    return res.status(500).json({ ok: false, msg: 'Error quitando de favoritos' });
  }
};

// ========== REVISIÓN (NUTRI / ADMIN) ==========
exports.reviewRecipe = async (req, res) => {
  try {
    const id = req.params.id;
    const { action, notes } = req.body; // action: 'approve' | 'reject'

    if (!id) return res.status(400).json({ ok: false, msg: 'ID requerido' });
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ ok: false, msg: 'Action inválida' });
    }

    const recipe = await Recipe.findById(id);
    if (!recipe) return res.status(404).json({ ok: false, msg: 'Receta no encontrada' });

    recipe.status = action === 'approve' ? 'approved' : 'rejected';
    recipe.reviewerNotes = notes || '';
    recipe.nutriReviewer = mongoose.Types.ObjectId(req.user.uid);
    recipe.updatedAt = new Date();

    await recipe.save();

    return res.json({ ok: true, msg: `Receta ${recipe.status}`, recipe: recipe.toObject() });
  } catch (err) {
    console.error('Error en reviewRecipe:', err);
    return res.status(500).json({ ok: false, msg: 'Error revisando la receta' });
  }
};

// ========== GET BY ID ==========
exports.getRecipeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, msg: 'ID inválido' });
    }
    const recipe = await Recipe.findById(id).lean();
    if (!recipe) {
      return res.status(404).json({ ok: false, msg: 'Receta no encontrada' });
    }
    return res.status(200).json({ ok: true, data: recipe });
  } catch (err) {
    console.error('Error en getRecipeById:', err);
    return res.status(500).json({ ok: false, msg: 'Error obteniendo la receta' });
  }
};

// ========== GET BULK BY IDS ==========
exports.getBulkByIds = async (req, res, next) => {
  try {
    let ids = req.query.ids;
    if (!ids) return res.status(400).json({ ok: false, msg: 'ids query requerido' });
    if (typeof ids === 'string') ids = ids.split(',');
    const recipes = await Recipe.find({ _id: { $in: ids } }).lean();
    res.json({ ok: true, data: recipes });
  } catch (err) {
    next(err);
  }
};

// ========== CREATE RECIPE (NUTRI / ADMIN) ==========
exports.createRecipe = async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?._id;
    if (!userId) {
      return res.status(401).json({ ok: false, msg: 'Usuario no autenticado' });
    }

    let {
      title,
      description,
      imageUrl,
      kcal,
      durationMin,    // alias que viene del front
      prepTimeMin,    // en caso de que decidas mandar directamente este campo
      servings,
      diets,
      categories,
      tags,
      ingredients,
      steps
    } = req.body;

    if (!title) {
      return res.status(400).json({ ok: false, msg: 'El título es obligatorio' });
    }

    const dietsArr = parseMaybeJsonArray(diets);
    const catArr = parseMaybeJsonArray(categories);
    const tagsArr = parseMaybeJsonArray(tags);

    let ingredientsArr = [];
    if (Array.isArray(ingredients)) {
      ingredientsArr = ingredients;
    } else if (typeof ingredients === 'string') {
      try {
        const parsed = JSON.parse(ingredients);
        if (Array.isArray(parsed)) ingredientsArr = parsed;
      } catch (e) {
        ingredientsArr = [];
      }
    }

    let stepsArr = [];
    if (Array.isArray(steps)) {
      stepsArr = steps;
    } else if (typeof steps === 'string') {
      try {
        const parsed = JSON.parse(steps);
        if (Array.isArray(parsed)) stepsArr = parsed;
      } catch (e) {
        stepsArr = steps
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    const instructionsHtml = buildInstructionsHtml(stepsArr);

    // Normalizamos: siempre guardamos en prepTimeMin
    let effectivePrepTime = null;
    if (prepTimeMin != null && prepTimeMin !== '') {
      effectivePrepTime = Number(prepTimeMin);
    } else if (durationMin != null && durationMin !== '') {
      effectivePrepTime = Number(durationMin);
    }

    const recipe = await Recipe.create({
      title,
      description: description || '',
      imageUrl: imageUrl || '',
      kcal: kcal ? Number(kcal) : null,
      prepTimeMin: effectivePrepTime,
      servings: servings ? Number(servings) : 1,
      diets: dietsArr,
      categories: catArr,
      tags: tagsArr,
      ingredients: ingredientsArr,
      steps: stepsArr,
      instructions: instructionsHtml,
      source: 'human',
      status: 'approved', // o 'pending' si quieres revisarla después
      createdBy: userId,
      local: false
    });

    return res.status(201).json({
      ok: true,
      data: recipe
    });
  } catch (err) {
    console.error('Error creando receta:', err);
    next(err);
  }
};

// ========== UPDATE RECIPE (NUTRI / ADMIN) ==========
exports.updateRecipe = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, msg: 'ID inválido' });
    }

    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return res.status(404).json({ ok: false, msg: 'Receta no encontrada' });
    }

    let {
      title,
      description,
      imageUrl,
      kcal,
      durationMin,
      prepTimeMin,
      servings,
      diets,
      categories,
      tags,
      ingredients,
      steps,
      status
    } = req.body;

    if (title != null) recipe.title = title.trim();
    if (description != null) recipe.description = description.trim();
    if (imageUrl != null) recipe.imageUrl = imageUrl.trim();

    if (kcal != null && kcal !== '') {
      recipe.kcal = Number(kcal);
    }

    let effectivePrepTime = recipe.prepTimeMin || null;
    if (prepTimeMin != null && prepTimeMin !== '') {
      effectivePrepTime = Number(prepTimeMin);
    } else if (durationMin != null && durationMin !== '') {
      effectivePrepTime = Number(durationMin);
    }
    recipe.prepTimeMin = effectivePrepTime;

    if (servings != null && servings !== '') {
      recipe.servings = Number(servings);
    }

    if (diets != null) {
      recipe.diets = parseMaybeJsonArray(diets);
    }
    if (categories != null) {
      recipe.categories = parseMaybeJsonArray(categories);
    }
    if (tags != null) {
      recipe.tags = parseMaybeJsonArray(tags);
    }

    if (ingredients != null) {
      let ingredientsArr = [];
      if (Array.isArray(ingredients)) {
        ingredientsArr = ingredients;
      } else if (typeof ingredients === 'string') {
        try {
          const parsed = JSON.parse(ingredients);
          if (Array.isArray(parsed)) ingredientsArr = parsed;
        } catch (e) {
          ingredientsArr = [];
        }
      }
      recipe.ingredients = ingredientsArr;
    }

    let stepsArr = recipe.steps || [];
    if (steps != null) {
      if (Array.isArray(steps)) {
        stepsArr = steps;
      } else if (typeof steps === 'string') {
        try {
          const parsed = JSON.parse(steps);
          if (Array.isArray(parsed)) stepsArr = parsed;
        } catch (e) {
          stepsArr = steps
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
      recipe.steps = stepsArr;
      recipe.instructions = buildInstructionsHtml(stepsArr);
    }

    if (status != null) {
      recipe.status = status; // opcional: validar enum aquí si quieres
    }

    recipe.updatedAt = new Date();

    await recipe.save();

    return res.json({ ok: true, data: recipe.toObject() });
  } catch (err) {
    console.error('Error actualizando receta:', err);
    next(err);
  }
};

// ========== DELETE RECIPE (NUTRI / ADMIN) ==========
exports.deleteRecipe = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, msg: 'ID inválido' });
    }

    const recipe = await Recipe.findByIdAndDelete(id);
    if (!recipe) {
      return res.status(404).json({ ok: false, msg: 'Receta no encontrada' });
    }

    return res.json({ ok: true, msg: 'Receta eliminada' });
  } catch (err) {
    console.error('Error eliminando receta:', err);
    return res.status(500).json({ ok: false, msg: 'Error eliminando receta' });
  }
};
