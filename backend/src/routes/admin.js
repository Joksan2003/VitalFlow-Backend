// src/routes/admin.js
const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/roleMiddleware');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

// all admin routes require admin role
router.use(authMiddleware, requireRole(['admin']));

// list requests
router.get('/nutriologo/requests', adminController.listRequests);

// get one
router.get('/nutriologo/requests/:id', adminController.getRequest);

// approve
router.post('/nutriologo/requests/:id/approve', adminController.approveRequest);

// reject
router.post('/nutriologo/requests/:id/reject', adminController.rejectRequest);

module.exports = router;