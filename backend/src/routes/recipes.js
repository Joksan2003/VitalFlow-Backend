// backend/src/routes/recipes.js
const express = require('express');
const router = express.Router();
const recipeController = require('../Controllers/recipeController');

const auth = require('../Middleware/authMiddleware');
const { requireRole } = require('../Middleware/roleMiddleware');

// 🔹 RUTAS CONCRETAS PRIMERO

/** GET /api/recipes  -> listado público (filtrado/paginado) */
router.get('/', recipeController.listRecipes);

/** GET /api/recipes/me -> recetas del usuario autenticado (protegida) */
router.get('/me', auth, recipeController.getMyRecipes);

/** GET /api/recipes/favorites/me -> favoritos del usuario autenticado */
router.get('/favorites/me', auth, recipeController.getMyFavoriteRecipes);

/** GET /api/recipes/bulk?ids=... -> varias recetas por id (puede ir protegida o no) */
router.get('/bulk', auth, recipeController.getBulkByIds);

/** GET /api/recipes/review -> listado para revisión (nutriólogo / admin) */
router.get(
  '/review',
  auth,
  requireRole(['nutriologo', 'admin']),
  recipeController.listPendingRecipes
);

// 🔹 Crear receta (solo nutriólogo / admin)
router.post(
  '/',
  auth,
  requireRole(['nutriologo', 'admin']),
  recipeController.createRecipe
);

// 🔹 Actualizar receta (solo nutriólogo / admin)
router.patch(
  '/:id',
  auth,
  requireRole(['nutriologo', 'admin']),
  recipeController.updateRecipe
);

// 🔹 Eliminar receta (solo nutriólogo / admin)
router.delete(
  '/:id',
  auth,
  requireRole(['nutriologo', 'admin']),
  recipeController.deleteRecipe
);

// ⭐ NUEVO: marcar como favorito
router.post('/:id/favorite', auth, recipeController.addFavorite);

// ⭐ NUEVO: quitar de favoritos
router.delete('/:id/favorite', auth, recipeController.removeFavorite);

// 🔹 Revisar (aprobar / rechazar) receta (nutriólogo / admin)
router.patch(
  '/:id/review',
  auth,
  requireRole(['nutriologo', 'admin']),
  recipeController.reviewRecipe
);

// 🔹 Detalle público por ID (esta va al final)
router.get('/:id', recipeController.getRecipeById);

module.exports = router;