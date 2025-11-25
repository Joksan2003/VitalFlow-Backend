// backend/src/config/email.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // con 587 va en false, 465 -> true
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify()
  .then(() => console.log("✅ SMTP listo para enviar correos"))
  .catch((err) => console.error("❌ Error en SMTP:", err));

module.exports = transporter;