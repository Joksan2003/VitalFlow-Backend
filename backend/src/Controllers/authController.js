// backend/src/Controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');      // 👈 FALTABA ESTA LÍNEA
const User = require('../models/user');

const transporter = require('../config/email'); // 👈 AGREGA ESTO

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

if (!JWT_SECRET) {
  console.warn('JWT_SECRET no definido en .env — genera uno antes de producción');
}

const signToken = (user) => {
  // 👇 ahora incluimos role e isVerified en el payload
  return jwt.sign(
    {
      uid: user._id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, msg: 'Email y contraseña son obligatorios' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ ok: false, msg: 'El email ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({ name, email, passwordHash });
    await user.save();

    const token = signToken(user);

    res.status(201).json({
      ok: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isVerified: user.isVerified
      },
      token
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, msg: 'Email y contraseña son obligatorios' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ ok: false, msg: 'Credenciales inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ ok: false, msg: 'Credenciales inválidas' });
    }

    const token = signToken(user);

    res.json({
      ok: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isVerified: user.isVerified,                        // ✅ importante
        onboardingCompleted: !!user.onboardingCompleted, // ✅ importante
      },
      token
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/forgot-password
// body: { email }
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ ok: false, msg: 'Email requerido' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Para no revelar si el correo existe o no, devolvemos 200 siempre
    if (!user) {
      return res.json({
        ok: true,
        msg: 'Si el email existe, se ha enviado un enlace de recuperación.'
      });
    }

    // genera token aleatorio
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 1000 * 60 * 60; // 1 hora

    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(expires);
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    // ---- ENVÍO DE CORREO REAL ----
    const from =
      process.env.SMTP_FROM ||
      `VitalFlow <${process.env.SMTP_USER || 'no-reply@vitalflow.test'}>`;

    const mailOptions = {
      from,
      to: user.email,
      subject: 'Recuperación de contraseña - VitalFlow',
      html: `
        <p>Hola ${user.name || ''},</p>
        <p>Hemos recibido una solicitud para restablecer tu contraseña en <strong>VitalFlow</strong>.</p>
        <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
        <p><a href="${resetLink}" target="_blank">${resetLink}</a></p>
        <p>Este enlace será válido por 1 hora.</p>
        <p>Si no realizaste esta solicitud, puedes ignorar este correo.</p>
        <br/>
        <p>– El equipo de VitalFlow</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('📧 Email de reset enviado a', user.email);
    } catch (mailErr) {
      console.error('❌ Error enviando email de reset:', mailErr);
      // No rompemos la UX del usuario; solo lo registramos
    }

    // También lo dejamos en consola para pruebas locales
    console.log('🔐 Enlace de reset para', user.email, '=>', resetLink);

    return res.json({
      ok: true,
      msg: 'Si el email existe, se ha enviado un enlace de recuperación.'
    });
  } catch (err) {
    console.error('forgotPassword error:', err);
    next(err);
  }
};
// POST /api/auth/reset-password
// body: { token, password }
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ ok: false, msg: 'Token y nueva contraseña requeridos' });
    }

    const now = new Date();

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: now } // que no esté expirado
    });

    if (!user) {
      return res.status(400).json({ ok: false, msg: 'Token inválido o expirado' });
    }

    // hashear nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    user.passwordHash = passwordHash;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.json({ ok: true, msg: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('resetPassword error:', err);
    next(err);
  }
};


exports.me = async (req, res, next) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, msg: 'No autorizado' });

    const user = await User.findById(uid).select('-passwordHash');
    if (!user) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    res.json({
      ok: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        onboardingCompleted: user.onboardingCompleted,
      }
    });
  } catch (err) {
    next(err);
  }
};