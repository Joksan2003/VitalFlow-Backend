// src/routes/user.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../Middleware/authMiddleware');
const { upload } = require('../utils/uploader'); // multer memory storage
const userController = require('../Controllers/userController');

// GET /api/user/me -> obtener perfil del usuario autenticado
router.get('/me', authMiddleware, userController.getMe);

// PATCH /api/user/me -> actualizar perfil/preferencias del usuario autenticado
// acepta multipart/form-data con campo 'avatar' (single) o JSON
router.patch('/me', authMiddleware, upload.single('avatar'), userController.updateMe);

// mantengo ruta legacy /profile como alias para compatibilidad
router.patch('/profile', authMiddleware, upload.single('avatar'), userController.updateProfile);

module.exports = router;