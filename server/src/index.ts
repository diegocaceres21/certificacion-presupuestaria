import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createPool } from './db';

// Route imports
import authRoutes from './routes/auth';
import dependenciasRoutes from './routes/dependencias';
import unidadesRoutes from './routes/unidades';
import tipoCuentasRoutes from './routes/tipo-cuentas';
import cuentasRoutes from './routes/cuentas';
import proyectosRoutes from './routes/proyectos';
import usuariosRoutes from './routes/usuarios';
import certificacionesRoutes from './routes/certificaciones';
import observacionesRoutes from './routes/observaciones';
import modificacionesRoutes from './routes/modificaciones';
import reportesRoutes from './routes/reportes';
import syncRoutes from './routes/sync';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dependencias', dependenciasRoutes);
app.use('/api/unidades', unidadesRoutes);
app.use('/api/tipo-cuentas', tipoCuentasRoutes);
app.use('/api/cuentas', cuentasRoutes);
app.use('/api/proyectos', proyectosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/certificaciones', certificacionesRoutes);
app.use('/api/observaciones', observacionesRoutes);
app.use('/api/modificaciones', modificacionesRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/sync', syncRoutes);

// Start server
async function main() {
  try {
    createPool();
    console.log('Database pool created');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
