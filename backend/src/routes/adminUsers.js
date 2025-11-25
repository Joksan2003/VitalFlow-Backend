// src/routes/adminUsers.js
const express = require("express");
const router = express.Router();

const auth = require("../Middleware/authMiddleware");
const { requireRole } = require("../Middleware/roleMiddleware"); // ya lo usas en otros lados
const userController = require("../Controllers/userController");

// Todas estas rutas requieren admin
router.get(
  "/users",
  auth,
  requireRole(["admin"]),
  userController.adminListUsers
);

router.get(
  "/users/:id",
  auth,
  requireRole(["admin"]),
  userController.adminGetUserById
);

router.patch(
  "/users/:id",
  auth,
  requireRole(["admin"]),
  userController.adminUpdateUser
);

router.delete(
  "/users/:id",
  auth,
  requireRole(["admin"]),
  userController.adminDeleteUser
);

module.exports = router;