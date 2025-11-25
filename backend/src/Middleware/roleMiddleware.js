// src/middleware/roleMiddleware.js
const User = require('../models/user');

function requireRole(roles = []) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.uid) return res.status(401).json({ ok: false, msg: 'No autorizado' });

      // si el token incluye role/isVerified ya está; si no, fetch user
      let role = req.user.role;
      let isVerified = req.user.isVerified;
      if (!role) {
        const u = await User.findById(req.user.uid).select('role isVerified');
        if (!u) return res.status(401).json({ ok: false, msg: 'Usuario no encontrado' });
        role = u.role;
        isVerified = u.isVerified;
        req.user.role = role;
        req.user.isVerified = isVerified;
      }

      if (!roles.includes(role)) {
        return res.status(403).json({ ok: false, msg: 'Acceso prohibido' });
      }

      // si requiere nutriologo, verifica isVerified
      if (roles.includes('nutriologo') && role === 'nutriologo' && !isVerified) {
        return res.status(403).json({ ok: false, msg: 'Cuenta de nutriólogo no verificada' });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireRole };