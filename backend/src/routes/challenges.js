const express = require('express');
const router = express.Router();
const auth = require('../Middleware/authMiddleware');
const { requireRole } = require('../Middleware/roleMiddleware');
const challengeController = require('../Controllers/challengeController');

// -----------------------------
// PUBLIC LIST (filtrado/paginado)
// -----------------------------
router.get('/', challengeController.listChallenges);

// -----------------------------
// MIS RETOS (PRIMERO para evitar capturar /me como :id)
// -----------------------------
router.get('/me/active', auth, challengeController.getMyActiveChallenges);
router.get('/me/completed', auth, challengeController.getMyCompletedChallenges);

// -----------------------------
// NUTRIOLOGO CREA / EDITA / BORRA
// -----------------------------
router.post('/', auth, requireRole(['nutriologo','admin']), challengeController.createChallenge);
router.put('/:id', auth, requireRole(['nutriologo','admin']), challengeController.updateChallenge);
router.delete('/:id', auth, requireRole(['nutriologo','admin']), challengeController.deleteChallenge);

// -----------------------------
// USUARIO: unirse / abandonar / marcar completado
// -----------------------------
router.post('/:id/join', auth, challengeController.joinChallenge);
router.post('/:id/leave', auth, challengeController.leaveChallenge);
router.post('/:id/mark', auth, challengeController.markCompletedToday);

// -----------------------------
// GET CHALLENGE BY ID (AL FINAL SIEMPRE)
// -----------------------------
router.get('/:id', challengeController.getChallengeById);

module.exports = router;