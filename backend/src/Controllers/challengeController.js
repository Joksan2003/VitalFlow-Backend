const Challenge = require('../models/Challenge');
const User = require('../models/user');
const mongoose = require('mongoose');

exports.listChallenges = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, q, status } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const filter = {};

    // 🔹 Filtro por estado según lo que mandas desde el front
    if (status === 'active' || !status) {
      filter.isActive = true;          // por defecto: solo activos
    } else if (status === 'inactive') {
      filter.isActive = false;
    } else if (status === 'all') {
      // no ponemos isActive en el filtro => trae todos
    }

    // 🔹 Búsqueda por texto
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { title: regex },
        { description: regex },
        { tags: regex },
      ];
    }

    const total = await Challenge.countDocuments(filter);
    const data = await Challenge.find(filter)
      .sort({ createdAt: -1 })
      .skip((p - 1) * lim)
      .limit(lim)
      .lean();

    res.json({ ok: true, data, total, page: p, limit: lim });
  } catch (err) {
    next(err);
  }
};

exports.getChallengeById = async (req,res) => {
  try {
    const ch = await Challenge.findById(req.params.id).lean();
    if (!ch) return res.status(404).json({ ok:false, msg:'No encontrado' });
    res.json({ ok:true, data: ch });
  } catch(err){ console.error(err); res.status(500).json({ ok:false, msg:'Error' }); }
};

exports.createChallenge = async (req,res) => {
  try {
    const body = req.body;
    const newCh = new Challenge({
      title: body.title,
      description: body.description,
      imageUrl: body.imageUrl,
      durationDays: body.durationDays || 7,
      startDate: body.startDate || Date.now(),
      endDate: body.endDate,
      createdBy: req.user.uid,
      rewardPoints: body.rewardPoints || 10,
      tags: body.tags || []
    });
    await newCh.save();
    res.status(201).json({ ok:true, data: newCh });
  } catch(err){ next(err); }
};

exports.updateChallenge = async (req,res) => {
  try {
    const ch = await Challenge.findById(req.params.id);
    if (!ch) return res.status(404).json({ ok:false, msg:'No encontrado' });
    // (podrías validar req.user.uid === ch.createdBy para sólo editar el creador)
    Object.assign(ch, req.body, { updatedAt: new Date() });
    await ch.save();
    res.json({ ok:true, data: ch });
  } catch(err){ next(err); }
};

exports.deleteChallenge = async (req,res) => {
  try {
    await Challenge.findByIdAndDelete(req.params.id);
    res.json({ ok:true, msg:'Eliminado' });
  } catch(err){ next(err); }
};

// Usuario se une
exports.joinChallenge = async (req,res) => {
  try {
    const userId = req.user.uid;
    const chId = req.params.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok:false, msg:'Usuario no encontrado' });

    // evitar duplicados
    if (user.activeChallenges.some(a => a.challengeId?.toString() === chId.toString())) {
      return res.status(400).json({ ok:false, msg:'Ya estás inscrito' });
    }

    user.activeChallenges.push({
  challengeId: chId,
  joinedAt: new Date()
});
    await user.save();
    res.json({ ok:true, msg:'Inscrito', activeChallenges: user.activeChallenges });
  } catch(err){ console.error(err); res.status(500).json({ ok:false, msg:'Error' }); }
};

// Usuario abandona
exports.leaveChallenge = async (req,res) => {
  try {
    const userId = req.user.uid;
    const chId = req.params.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok:false, msg:'Usuario no encontrado' });

    user.activeChallenges = user.activeChallenges.filter(a => a.challengeId.toString() !== chId.toString());
    await user.save();
    res.json({ ok:true, msg:'Abandonado', activeChallenges: user.activeChallenges });
  } catch(err){ console.error(err); res.status(500).json({ ok:false, msg:'Error' }); }
};

// lógica de marcar completado hoy (24h lock)
exports.markCompletedToday = async (req,res) => {
  try {
    const userId = req.user.uid;
    const chId = req.params.id;
    const now = new Date();

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok:false, msg:'Usuario no encontrado' });

    const a = user.activeChallenges.find(ac => ac.challengeId?.toString() === chId.toString());
    if (!a) return res.status(400).json({ ok:false, msg:'No inscrito en el reto' });

    // cool down 24 horas: if lastMarkedAt within 24h, block
    if (a.lastMarkedAt && (now - new Date(a.lastMarkedAt)) < 24*60*60*1000) {
      return res.status(400).json({ ok:false, msg:'Debes esperar 24h entre marcas' });
    }

    // incrementar counters
    a.lastMarkedAt = now;
    a.completedDays = (a.completedDays || 0) + 1;
    a.streak = (a.streak || 0) + 1;

    // Si completó la duración => mover a completedChallenges y otorgar puntos
    const ch = await Challenge.findById(chId);
    const required = ch?.durationDays || 7;
    let finished = false;
    if (a.completedDays >= required) {
      finished = true;
      // añadir a completedChallenges
      user.completedChallenges.push({
        challengeId: a.challengeId,
        finishedAt: now,
        totalPoints: ch.rewardPoints * required // ejemplo: puntos por dia * dias
      });
      user.points = (user.points || 0) + (ch.rewardPoints * required);
      // remover de activeChallenges
      user.activeChallenges = user.activeChallenges.filter(x => x.challengeId.toString() !== chId.toString());
    }

    await user.save();
    res.json({ ok:true, finished, activeChallenges: user.activeChallenges, completedChallenges: user.completedChallenges });
  } catch(err){ console.error(err); res.status(500).json({ ok:false, msg:'Error' }); }
};

exports.getMyActiveChallenges = async (req,res) => {
  try {
    const userId = req.user.uid;
    const user = await User.findById(userId).populate('activeChallenges.challengeId').lean();
    if (!user) return res.status(404).json({ ok:false, msg:'Usuario no encontrado' });
    res.json({ ok:true, active: user.activeChallenges });
  } catch(err){ console.error(err); res.status(500).json({ ok:false, msg:'Error' }); }
};

exports.getMyCompletedChallenges = async (req,res) => {
  try {
    const userId = req.user.uid;
    const user = await User.findById(userId).populate('completedChallenges.challengeId').lean();
    if (!user) return res.status(404).json({ ok:false, msg:'Usuario no encontrado' });
    res.json({ ok:true, completed: user.completedChallenges });
  } catch(err){ console.error(err); res.status(500).json({ ok:false, msg:'Error' }); }
};