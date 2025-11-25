// backend/src/config/email.js
const nodemailer = require("nodemailer");

let transporter;

// En producción (Render) -> usamos transporte "falso" que NO conecta por SMTP
if (process.env.NODE_ENV === "production") {
  transporter = nodemailer.createTransport({
    jsonTransport: true, // solo imprime el mail como JSON
  });

  console.log("📧 Email en PRODUCCIÓN: usando jsonTransport (no se envía realmente)");
} else {
  // En desarrollo -> usamos Gmail SMTP como siempre
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Verificar solo en dev
  transporter
    .verify()
    .then(() => console.log("✅ Conexión SMTP lista (DEV)"))
    .catch((err) => console.error("❌ Error en SMTP (DEV):", err));
}

// Función genérica para enviar correo
async function sendMail({ to, subject, html, text }) {
  // En producción, nodemailer con jsonTransport no hace conexión real
  const mailOptions = {
    from: process.env.SMTP_FROM || '"VitalFlow" <no-reply@vitalflow.test>',
    to,
    subject,
    html,
    text,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("📨 Email generado:", info);

  return info;
}

module.exports = { sendMail };