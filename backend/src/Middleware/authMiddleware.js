// backend/src/Middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('JWT_SECRET no definido — usa .env');
}

module.exports = (req, res, next) => {
  const authHeader = req.header('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, msg: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // payload: { uid, email, role, isVerified, iat, exp }
    req.user = {
      uid: payload.uid,
      email: payload.email,
      role: payload.role,
      isVerified: payload.isVerified
    };
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, msg: 'Token inválido' });
  }
};