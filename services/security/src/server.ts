import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './api/routes.js';
import { runAttackPathsJobV1 } from './engine/attackPathsJobRunner.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const app = express();
const PORT = Number(process.env.PORT || 5001);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/verion-security';

app.use(cors());
app.use(express.json());

app.use('/api/v1', routes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'verion-security', version: '0.1.0' });
});

async function startServer() {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[verion-security] Service running on http://127.0.0.1:${PORT}`);
  });

  console.log(`[verion-security] Connecting to local security storage...`);
  mongoose.connect(MONGODB_URI).then(() => {
    console.log(`[verion-security] Connected to local security storage.`);
    // Start background scanning engine loop
    runAttackPathsJobV1().catch((err) => {
      console.error(`[verion-security] Background review failed:`, err);
    });
  }).catch((err) => {
    console.error(`[verion-security] Could not connect to local security storage:`, err.message || err);
  });
}

startServer();
