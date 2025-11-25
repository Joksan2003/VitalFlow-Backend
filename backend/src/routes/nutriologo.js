// src/routes/nutriologo.js
const express = require('express');
const router = express.Router();
const { upload } = require('../utils/uploader');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// multipart: certificate, cv optional
const multi = upload.fields([{ name: 'certificate', maxCount: 1 }, { name: 'cv', maxCount: 1 }]);

// POST /api/nutriologo/request
router.post('/request', authMiddleware, multi, userController.createNutriologoRequest);

// GET /api/nutriologo/request/me
router.get('/request/me', authMiddleware, userController.getMyNutriologoRequest);

module.exports = router;