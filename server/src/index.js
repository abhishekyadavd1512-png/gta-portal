import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { login, logout, requireAuth, requireRole, toPublicUser } from './auth.js';
import profileRoutes from './routes/profile.js';
import sectionRoutes from './routes/sections.js';
import applicationRoutes from './routes/applications.js';
import facultyRoutes from './routes/faculty.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: toPublicUser(req.user) }));

app.use('/api/profile', requireAuth, profileRoutes);
app.use('/api/sections', requireAuth, sectionRoutes);
app.use('/api/applications', requireAuth, requireRole('APPLICANT'), applicationRoutes);
app.use('/api/faculty', requireAuth, requireRole('FACULTY', 'ADMIN'), facultyRoutes);
app.use('/api/admin', requireAuth, requireRole('ADMIN'), adminRoutes);

// In production (Render), one web service serves both the API and the built
// React app from the same origin, so there's no separate frontend host and
// no cross-site cookie issues. `npm run build` (run during the Render build
// step — see render.yaml) produces client/dist; this is a no-op locally
// during `npm run dev` since that folder doesn't exist yet.
const clientDist = path.join(__dirname, '../../client/dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  // Anything that isn't an /api route falls through to the SPA so
  // react-router can handle client-side routes like /faculty or /apply.
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Centralized error handler so an unexpected DB/error doesn't crash the process.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`GTA Portal API listening on http://localhost:${PORT}`);
});
