// src/models/NutriologoRequest.js
const mongoose = require('mongoose');

const reqSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // DATOS PERSONALES BÁSICOS
  fullName: { type: String },
  phone: { type: String },
  city: { type: String },

  // NUEVOS CAMPOS PROFESIONALES
  professionalId: { type: String },          // cédula profesional
  degree: { type: String },                  // Lic. en Nutrición, etc.
  university: { type: String },              // universidad / institución
  yearsExperience: { type: Number },         // años de experiencia
  specialties: { type: [String], default: [] }, // ej: ["nutrición deportiva","obesidad"]

  // INFORMACIÓN DE SERVICIOS
  mainWorkplace: { type: String },           // clínica / consultorio
  modalities: {                              // modalidades de atención
    type: [String],
    default: [],
  },
  website: { type: String },
  instagram: { type: String },

  // ARCHIVOS
  certificateUrl: { type: String },
  cvUrl: { type: String },

  // NOTAS DEL POSTULANTE
  notes: { type: String },

  // ESTADO DE LA SOLICITUD
  status: {
    type: String,
    enum: ['pending','approved','rejected','needs_info'],
    default: 'pending'
  },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminNotes: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NutriologoRequest', reqSchema);