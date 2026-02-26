import { Router, Request, Response } from 'express';
import { getPool, RowDataPacket } from '../db';
import { authMiddleware, requireRole } from '../middleware';
import { hashPassword } from '../auth';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

// GET /api/usuarios
router.get('/', requireRole('administrador'), async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.usuario, u.activo, p.nombre_completo, p.cargo, p.rol
       FROM usuario u
       INNER JOIN perfil p ON p.id_usuario = u.id
       ORDER BY p.nombre_completo`
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usuarios/simple - active users only, any role can access
router.get('/simple', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.usuario, u.activo, p.nombre_completo, p.cargo, p.rol
       FROM usuario u
       INNER JOIN perfil p ON p.id_usuario = u.id
       WHERE u.activo = TRUE
       ORDER BY p.nombre_completo`
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/usuarios
router.post('/', requireRole('administrador'), async (req: Request, res: Response) => {
  try {
    const { usuario, password, nombre_completo, cargo, rol } = req.body;
    const userId = crypto.randomUUID();
    const perfilId = crypto.randomUUID();
    const pool = getPool();
    const hashed = hashPassword(password);

    await pool.query(
      'INSERT INTO usuario (id, usuario, password) VALUES (?, ?, ?)',
      [userId, usuario, hashed]
    );

    await pool.query(
      'INSERT INTO perfil (id, id_usuario, nombre_completo, cargo, rol) VALUES (?, ?, ?, ?, ?)',
      [perfilId, userId, nombre_completo, cargo, rol]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.usuario, u.activo, p.nombre_completo, p.cargo, p.rol
       FROM usuario u INNER JOIN perfil p ON p.id_usuario = u.id
       WHERE u.id = ?`,
      [userId]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/usuarios/:id
router.put('/:id', requireRole('administrador'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    if (req.body.activo !== undefined) {
      await pool.query('UPDATE usuario SET activo = ? WHERE id = ?', [req.body.activo, id]);
    }

    const [perfilRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM perfil WHERE id_usuario = ?',
      [id]
    );
    if (perfilRows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    const currentPerfil = perfilRows[0];
    await pool.query(
      'UPDATE perfil SET nombre_completo = ?, cargo = ?, rol = ? WHERE id_usuario = ?',
      [
        req.body.nombre_completo ?? currentPerfil.nombre_completo,
        req.body.cargo ?? currentPerfil.cargo,
        req.body.rol ?? currentPerfil.rol,
        id,
      ]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.usuario, u.activo, p.nombre_completo, p.cargo, p.rol
       FROM usuario u INNER JOIN perfil p ON p.id_usuario = u.id
       WHERE u.id = ?`,
      [id]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/usuarios/:id/resetear-password
router.post('/:id/resetear-password', requireRole('administrador'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { nueva_password } = req.body;
    const pool = getPool();

    const hashed = hashPassword(nueva_password);
    await pool.query('UPDATE usuario SET password = ? WHERE id = ?', [hashed, id]);

    res.json({ message: 'Contraseña reseteada correctamente' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
