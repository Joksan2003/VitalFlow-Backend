require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./backend/src/config/db');

const app = express();
const PORT = process.env.PORT || 5000;

const adminUsersRoutes = require("./backend/src/routes/adminUsers");

// Conectar a MongoDB
connectDB();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://vitalflow-front.onrender.com", // Link cambiado
];

// Middlewares
app.use(
  cors({
    origin: (origin, cb) => {
      // permitir herramientas tipo curl / postman (sin origin)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS: " + origin), false);
    },
    credentials: true,
  })
);

app.get("/health", (req, res) => {
  res.json({ ok: true, status: "healthy" });
});


app.use(express.json());



// Ruta de prueba
app.get('/', (req, res) => res.send('VitalFlow API - auth service'));

// Rutas
app.use('/api/auth', require('./backend/src/routes/auth'));
app.use('/api/nutriologo', require('./backend/src/routes/nutriologo'));
app.use('/api/admin', require('./backend/src/routes/admin'));

app.use('/api/user', require('./backend/src/routes/user'));

//Rutas de recetas
app.use('/api/recipes', require('./backend/src/routes/recipes'));
//PlanIA
app.use('/api/plans', require('./backend/src/routes/plans'));

//PlanIA
app.use('/api/challenges', require('./backend/src/routes/challenges'));


app.use("/api/admin", adminUsersRoutes);

// Error handler básico
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ ok: false, msg: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});


