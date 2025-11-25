// src/controllers/userController.js

const NutriologoRequest = require('../models/NutriologoRequest');
const User = require('../models/user'); // asegúrate del nombre de archivo real
const { uploadBufferToCloudinary } = require('../utils/uploader');
const { sendMail } = require('../utils/mailer');

/**
 * Crear solicitud para convertirse en nutriólogo
 * POST /api/nutriologo/request
 */
// src/controllers/userController.js

exports.createNutriologoRequest = async (req, res, next) => {
  try {
    const uid = req.user && req.user.uid;
    if (!uid) return res.status(401).json({ ok: false, msg: 'No autorizado' });

    const {
      fullName,
      phone,
      city,
      notes,

      // NUEVOS CAMPOS PROFESIONALES
      professionalId,
      degree,
      university,
      yearsExperience,

      // ÁREAS Y SERVICIOS
      specialties,
      mainWorkplace,
      modalities,
      website,
      instagram,
    } = req.body;

    // evitar duplicados pendientes
    const existing = await NutriologoRequest.findOne({ userId: uid, status: 'pending' });
    if (existing) {
      return res
        .status(400)
        .json({ ok: false, msg: 'Ya existe una solicitud pendiente' });
    }

    // --- Procesar specialties (puede venir como string "a, b, c" o array) ---
    let specialtiesArr = [];
    if (specialties) {
      if (Array.isArray(specialties)) {
        specialtiesArr = specialties.map((s) => String(s).trim()).filter(Boolean);
      } else {
        specialtiesArr = String(specialties)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    // --- Procesar modalities (por si en el futuro permites varias) ---
    let modalitiesArr = [];
    if (modalities) {
      if (Array.isArray(modalities)) {
        modalitiesArr = modalities.map((m) => String(m).trim()).filter(Boolean);
      } else {
        modalitiesArr = String(modalities)
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean);
      }
    }

    // yearsExperience a número
    let yearsExpNum = undefined;
    if (typeof yearsExperience !== 'undefined' && yearsExperience !== '') {
      const n = Number(yearsExperience);
      if (!Number.isNaN(n)) yearsExpNum = n;
    }

    // archivos en memoria (multer)
    let certificateUrl = '';
    let cvUrl = '';
    if (req.files) {
      if (req.files.certificate && req.files.certificate[0]) {
        certificateUrl = await uploadBufferToCloudinary(
          req.files.certificate[0].buffer,
          'nutriologos/certificados'
        );
      }
      if (req.files.cv && req.files.cv[0]) {
        cvUrl = await uploadBufferToCloudinary(
          req.files.cv[0].buffer,
          'nutriologos/cv'
        );
      }
    }

    const reqDoc = new NutriologoRequest({
      userId: uid,

      // personales
      fullName,
      phone,
      city,

      // profesionales
      professionalId,
      degree,
      university,
      yearsExperience: yearsExpNum,

      specialties: specialtiesArr,

      // servicios
      mainWorkplace,
      modalities: modalitiesArr,
      website,
      instagram,

      // archivos y notas
      certificateUrl,
      cvUrl,
      notes,
      status: 'pending',
    });

    await reqDoc.save();

    // Opcional: notificar admin vía email (si ADMIN_EMAIL configurado)
    try {
      if (process.env.ADMIN_EMAIL) {
        await sendMail({
          to: process.env.ADMIN_EMAIL,
          subject: 'Nueva solicitud de nutriólogo',
          text: `Usuario ${uid} ha enviado una solicitud de nutriólogo. Revísala en el panel de admin.`,
        });
      }
    } catch (mailErr) {
      console.warn(
        'No se pudo enviar mail a admin:',
        mailErr.message || mailErr
      );
    }

    res.status(201).json({ ok: true, request: reqDoc });
  } catch (err) {
    next(err);
  }
};

/**
 * Obtener la solicitud del usuario actual
 * GET /api/nutriologo/request/me
 */
exports.getMyNutriologoRequest = async (req, res, next) => {
  try {
    const uid = req.user && req.user.uid;
    if (!uid) return res.status(401).json({ ok: false, msg: 'No autorizado' });

    const reqDoc = await NutriologoRequest.findOne({ userId: uid }).sort({ createdAt: -1 });
    if (!reqDoc) return res.json({ ok: true, request: null });
    res.json({ ok: true, request: reqDoc });
  } catch (err) {
    next(err);
  }
};

/**
 * Actualizar perfil del usuario (name, bio y avatar)
 * PATCH /api/user/profile
 * - Acepta JSON { name, bio } o multipart/form-data con campo 'avatar' (single)
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const uid = req.user && req.user.uid;
    if (!uid) return res.status(401).json({ ok: false, msg: 'No autorizado' });

    const { name, bio } = req.body || {};

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    // Actualizar campos simples
    if (typeof name === 'string' && name.trim() !== '') user.name = name.trim();
    if (typeof bio === 'string') user.bio = bio;

    // Si viene avatar en req.file (multer single)
    if (req.file && req.file.buffer) {
      try {
        const url = await uploadBufferToCloudinary(req.file.buffer, 'usuarios/avatars');
        user.avatarUrl = url;
      } catch (err) {
        console.error('Error subiendo avatar a Cloudinary:', err);
        return res.status(500).json({ ok: false, msg: 'Error subiendo avatar' });
      }
    }

    user.updatedAt = Date.now();
    await user.save();

    const safeUser = user.toObject();
    delete safeUser.passwordHash;

    res.json({ ok: true, user: safeUser });
  } catch (err) {
    next(err);
  }
};

/**
 * Obtener datos del usuario autenticado
 * GET /api/user/me
 */
exports.getMe = async (req, res, next) => {
  try {
    const uid = req.user && req.user.uid;
    if (!uid) return res.status(401).json({ ok: false, msg: 'No autorizado' });

    const user = await User.findById(uid).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
};

/**
 * Actualizar datos del usuario autenticado (perfil + preferencias)
 * PATCH /api/user/me
 * - Acepta JSON con campos permitidos o multipart/form-data con campo 'avatar' (single)
 */
exports.updateMe = async (req, res, next) => {
  try {
    const uid = req.user && req.user.uid;
    if (!uid) return res.status(401).json({ ok: false, msg: 'No autorizado' });

    // campos permitidos para actualizar desde el frontend
    const allowed = [
      'name', 'bio', 'birthDate', 'gender', 'weightKg', 'heightCm',
      'activityLevel', 'diets', 'allergies', 'dislikes', 'favouriteIngredients',
      'goal', 'targetWeightKg', 'medicalNotes', 'locale', 'units', 'onboardingCompleted'
    ];

    const payload = req.body || {};

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    // Actualizar solo campos permitidos
    allowed.forEach((k) => {
      if (typeof payload[k] !== 'undefined') {
        // intenta parsear JSON si se mandó como string (ej. arrays desde form-data)
        try {
          const val = (typeof payload[k] === 'string' && (payload[k].startsWith('[') || payload[k].startsWith('{')))
            ? JSON.parse(payload[k])
            : payload[k];
          user[k] = val;
        } catch (e) {
          user[k] = payload[k];
        }
      }
    });

    // avatar (multer single -> req.file)
    if (req.file && req.file.buffer) {
      try {
        const url = await uploadBufferToCloudinary(req.file.buffer, 'usuarios/avatars');
        user.avatarUrl = url;
      } catch (err) {
        console.error('Error subiendo avatar a Cloudinary:', err);
        return res.status(500).json({ ok: false, msg: 'Error subiendo avatar' });
      }
    }

    user.updatedAt = Date.now();
    await user.save();

    const safeUser = user.toObject();
    delete safeUser.passwordHash;

    res.json({ ok: true, user: safeUser });
  } catch (err) {
    next(err);
  }
};

// --- ADMIN: listar usuarios con filtros ---
// GET /api/admin/users
exports.adminListUsers = async (req, res, next) => {
  try {
    const { q, role, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));

    const filter = {};
    if (role) {
      filter.role = role;
    }

    if (q && q.trim() !== "") {
      const rx = new RegExp(q.trim(), "i");
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * lim)
        .limit(lim)
        .lean(),
    ]);

    res.json({ ok: true, total, page: pageNum, limit: lim, users });
  } catch (err) {
    next(err);
  }
};

// --- ADMIN: obtener un usuario por id ---
// GET /api/admin/users/:id
exports.adminGetUserById = async (req, res, next) => {
  try {
    const id = req.params.id;
    const user = await User.findById(id).select("-passwordHash").lean();
    if (!user) return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });

    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
};

// --- ADMIN: actualizar datos básicos de un usuario ---
// PATCH /api/admin/users/:id
exports.adminUpdateUser = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { role, isVerified } = req.body;

    const update = {};
    if (role) update.role = role;
    if (typeof isVerified !== "undefined") update.isVerified = !!isVerified;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).select("-passwordHash");

    if (!user) return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });

    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
};

// --- ADMIN: eliminar usuario ---
// DELETE /api/admin/users/:id
exports.adminDeleteUser = async (req, res, next) => {
  try {
    const id = req.params.id;
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
    }
    // aquí podrías también borrar planes, retos, etc. relacionados si lo necesitas
    res.json({ ok: true, msg: "Usuario eliminado" });
  } catch (err) {
    next(err);
  }
};

