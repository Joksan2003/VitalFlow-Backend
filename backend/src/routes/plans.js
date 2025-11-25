// backend/src/routes/plans.js
const express = require('express');
const router = express.Router();
const planController = require('../Controllers/planController');
const auth = require('../Middleware/authMiddleware');
const { requireRole } = require('../Middleware/roleMiddleware');

// 🧠 Generar un nuevo plan (usuario normal)
router.post('/generate', auth, planController.generatePlan);

// 👤 Ver planes del usuario autenticado
router.get('/me', auth, planController.getMyPlans);

// 👀 Ver todos los planes (nutriólogo o admin)
router.get('/', auth, requireRole(['nutriologo', 'admin']), planController.getAllPlans);

// ✅ Aprobar un plan
router.patch('/:id/approve', auth, requireRole(['nutriologo','admin']), planController.approvePlan);

// ❌ Rechazar un plan (pendiente de implementar)
router.patch('/:id/reject', auth, requireRole(['nutriologo','admin']), async (req,res)=>{
  return res.status(501).json({ ok: false, msg: 'Función no implementada aún' });
});

module.exports = router;