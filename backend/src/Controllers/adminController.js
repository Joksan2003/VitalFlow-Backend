// src/controllers/adminController.js
const NutriologoRequest = require('../models/NutriologoRequest');
const User = require('../models/user');
const { sendMail } = require('../utils/mailer');

exports.listRequests = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const q = {};
    if (status) q.status = status;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      NutriologoRequest.find(q).populate('userId', 'name email').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      NutriologoRequest.countDocuments(q)
    ]);
    res.json({ ok: true, total, page: Number(page), limit: Number(limit), items });
  } catch (err) {
    next(err);
  }
};

exports.getRequest = async (req, res, next) => {
  try {
    const request = await NutriologoRequest.findById(req.params.id).populate('userId', 'name email');
    if (!request) return res.status(404).json({ ok: false, msg: 'Solicitud no encontrada' });
    res.json({ ok: true, request });
  } catch (err) {
    next(err);
  }
};

exports.approveRequest = async (req, res, next) => {
  try {
    const reqId = req.params.id;
    const adminId = req.user.uid;
    const request = await NutriologoRequest.findById(reqId);
    if (!request) return res.status(404).json({ ok: false, msg: 'Solicitud no encontrada' });
    if (request.status === 'approved') return res.status(400).json({ ok: false, msg: 'Ya aprobada' });

    // update request
    request.status = 'approved';
    request.adminId = adminId;
    request.adminNotes = req.body.adminNotes || '';
    await request.save();

    // update user role
    const user = await User.findById(request.userId);
    user.role = 'nutriologo';
    user.isVerified = true;
    await user.save();

    // notify user by email (opcional)
    try {
      await sendMail({
        to: user.email,
        subject: 'Solicitud de nutriólogo aprobada',
        text: `Hola ${user.name}, tu solicitud fue aprobada. Ya puedes acceder como nutriólogo.`
      });
    } catch (e) {
      console.warn('Error enviando mail:', e);
    }

    res.json({ ok: true, msg: 'Solicitud aprobada', request });
  } catch (err) {
    next(err);
  }
};

exports.rejectRequest = async (req, res, next) => {
  try {
    const reqId = req.params.id;
    const adminId = req.user.uid;
    const { adminNotes } = req.body;
    if (!adminNotes) return res.status(400).json({ ok: false, msg: 'adminNotes required' });

    const request = await NutriologoRequest.findById(reqId);
    if (!request) return res.status(404).json({ ok: false, msg: 'Solicitud no encontrada' });

    request.status = 'rejected';
    request.adminId = adminId;
    request.adminNotes = adminNotes;
    await request.save();

    // notify user by email
    try {
      const user = await User.findById(request.userId);
      await sendMail({
        to: user.email,
        subject: 'Solicitud de nutriólogo rechazada',
        text: `Hola ${user.name}, tu solicitud fue rechazada. Motivo: ${adminNotes}`
      });
    } catch (e) {
      console.warn('Error enviando mail:', e);
    }

    res.json({ ok: true, msg: 'Solicitud rechazada', request });
  } catch (err) {
    next(err);
  }
};