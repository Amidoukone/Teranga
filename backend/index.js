'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import Sequelize via models/index.js
const db = require('./models');
const { sequelize } = db;

// Activer les logs SQL si disponibles
if (sequelize?.options) {
  sequelize.options.logging = console.log;
}

const app = express();

/* ======================================================
   🛡️ Garde-fou global contre les crashs silencieux
   ====================================================== */
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});

/* ======================================================
   🧱 Middleware généraux
   ====================================================== */
app.set('trust proxy', 1);

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ======================================================
   📂 Servir correctement les fichiers uploadés
   ====================================================== */
// ⚙️ Résolution robuste du chemin absolu
const uploadsRoot = path.join(__dirname, 'uploads');

// Création automatique si manquant (utile en prod Docker)
const fs = require('fs');
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
  console.log('📂 Dossier uploads créé automatiquement:', uploadsRoot);
}

// ✅ Route publique pour les fichiers (PDF, images…)
app.use('/uploads', express.static(uploadsRoot));
console.log('✅ Fichiers statiques disponibles sur /uploads');

/* ======================================================
   🔧 Chargement robuste des routeurs Express
   ====================================================== */
function pickExpressRouter(mod) {
  const candidates = [mod, mod?.default, mod?.router];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'function' || typeof c?.use === 'function') return c;
  }
  return null;
}

function loadRouter(routeFsPath, mountPath) {
  try {
    const mod = require(routeFsPath);
    const router = pickExpressRouter(mod);

    if (!router) {
      const keys = mod && typeof mod === 'object' ? Object.keys(mod) : '(aucune clé)';
      console.error(`❌ Routeur invalide pour ${mountPath}`);
      console.error(`   Fichier: ${routeFsPath}`);
      console.error(`   Clés exportées: ${keys}`);
      return;
    }

    app.use(mountPath, router);
    console.log(`✅ Routeur chargé : ${mountPath}`);
  } catch (err) {
    console.error(`❌ Échec du chargement du routeur "${routeFsPath}" pour ${mountPath}:`, err.message);
  }
}

/* ======================================================
   🚀 Chargement des routes API (structure modulaire)
   ====================================================== */
// Auth & core
loadRouter('./src/routes/auth.routes', '/api/auth');
loadRouter('./src/routes/property.routes', '/api/properties');
loadRouter('./src/routes/user.routes', '/api/users');
loadRouter('./src/routes/service.routes', '/api/services');
loadRouter('./src/routes/task.routes', '/api/tasks');
loadRouter('./src/routes/evidence.routes', '/api/evidences');
loadRouter('./src/routes/transaction.routes', '/api/transactions');

// 🆕 Module Projets
loadRouter('./src/routes/project.routes', '/api/projects');
loadRouter('./src/routes/projectPhase.routes', '/api/project-phases');
loadRouter('./src/routes/projectDocument.routes', '/api/project-documents');

// 🆕🛒 Module Commerce (ajouts)
loadRouter('./src/routes/category.routes', '/api/categories');
loadRouter('./src/routes/product.routes', '/api/products');
loadRouter('./src/routes/order.routes', '/api/orders');
loadRouter('./src/routes/orderItem.routes', '/api/order-items');

/* ======================================================
   🔍 Healthcheck + racine
   ====================================================== */
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    name: 'Teranga API',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
  });
});

/* ======================================================
   ⚠️ Gestion des erreurs et 404
   ====================================================== */
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({ error: 'Route introuvable' });
});

app.use((err, _req, res, _next) => {
  console.error('❌ Erreur backend:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

/* ======================================================
   ⚙️ Démarrage du serveur
   ====================================================== */
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion MySQL OK');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API Teranga lancée sur http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Erreur DB:', err.message);
    process.exit(1);
  }
}

start();
