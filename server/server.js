import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDatabase } from './config/db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import messageRoutes from './routes/messages.js';
import groupRoutes from './routes/groups.js';
import statusRoutes from './routes/status.js';
import uploadRoutes from './routes/upload.js';
import notificationRoutes from './routes/notifications.js';
import { attachSocketServer } from './socket/index.js';

const app = express();
const httpServer = http.createServer(app);
app.set('trust proxy', 1);
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [...new Set([allowedOrigin, 'https://chatbox-frontend-xpert2009.vercel.app'].filter(Boolean))]
  : [...new Set([allowedOrigin, 'http://localhost:5173', 'http://localhost:4173'])];

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'FIREBASE_PROJECT_ID',
  'CLOUDINARY_CLOUD_NAME',
];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`Missing: ${varName} in .env file`);
    console.error('Check CREDENTIALS_GUIDE.md for setup help.');
  }
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to at least 32 characters.');
}

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a minute.' },
}));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((error, _req, res, _next) => {
  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: 'The submitted data is invalid.' });
  }
  if (error.code === 11000) return res.status(409).json({ error: 'That value is already in use.' });
  if (error.name === 'MulterError' && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Files must be 100 MB or smaller.' });
  }
  console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'An unexpected server error occurred.' });
});

const io = attachSocketServer(httpServer, allowedOrigin);
app.set('io', io);

const port = Number(process.env.PORT) || 5000;
try {
  await connectDatabase();
  httpServer.listen(port, () => console.log(`ChatBox API listening on ${port}`));
} catch (error) {
  console.error('Server startup failed:', error);
  process.exitCode = 1;
}
