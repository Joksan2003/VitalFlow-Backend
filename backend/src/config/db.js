const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI no está definido en .env');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, {
      // opciones modernas ya no necesarias en Mongoose 6/7, se dejan por compatibilidad
    });
    console.log('🗄️  Conectado a MongoDB');
  } catch (err) {
    console.error('Error conectando a MongoDB', err);
    process.exit(1);
  }
};

module.exports = connectDB;