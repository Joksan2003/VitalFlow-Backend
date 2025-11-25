const express = require('express');
const router = express.Router();
const authController = require('../Controllers/authController');
const authMiddleware = require('../Middleware/authMiddleware');

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login
router.post('/login', authController.login);

// GET /api/auth/me (protegida)
router.get('/me', authMiddleware, authController.me);

// 👉 NUEVO: solicitar reset de contraseña
router.post('/forgot-password', authController.forgotPassword);

// 👉 NUEVO: hacer el reset con token
router.post('/reset-password', authController.resetPassword);

module.exports = router;