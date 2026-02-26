import { Router, Request, Response } from 'express';
import { getPool, RowDataPacket } from '../db';
import { hashPassword, verifyPassword, createToken, validateToken } from '../auth';
import { authMiddleware } from '../middleware';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
      res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
      return;
    }

    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT u.id, u.password, u.activo FROM usuario u WHERE u.usuario = ?',
      [usuario]
    );

    if (rows.length === 0) {
      res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      return;
    }

    const user = rows[0];
    if (!user.activo) {
      res.status(403).json({ error: 'Usuario desactivado. Contacte al administrador.' });
      return;
    }

    if (!verifyPassword(password, user.password)) {
      res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      return;
    }

    const [perfilRows] = await pool.query<RowDataPacket[]>(
      'SELECT p.nombre_completo, p.cargo, p.rol FROM perfil p WHERE p.id_usuario = ?',
      [user.id]
    );

    if (perfilRows.length === 0) {
      res.status(500).json({ error: 'Perfil de usuario no encontrado' });
      return;
    }

    const perfil = perfilRows[0];
    const token = createToken(user.id, perfil.rol, perfil.nombre_completo);

    res.json({
      token,
      user: {
        id: user.id,
        usuario,
        nombre_completo: perfil.nombre_completo,
        cargo: perfil.cargo,
        rol: perfil.rol,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Token requerido' });
      return;
    }

    const claims = validateToken(token);
    res.json({
      id: claims.sub,
      usuario: '',
      nombre_completo: claims.nombre,
      cargo: '',
      rol: claims.rol,
    });
  } catch (err: any) {
    res.status(401).json({ error: 'Token inválido: ' + err.message });
  }
});

// POST /api/auth/cambiar-password
router.post('/cambiar-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { password_actual, password_nueva } = req.body;
    const userId = req.claims!.sub;

    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT password FROM usuario WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    if (!verifyPassword(password_actual, rows[0].password)) {
      res.status(400).json({ error: 'Contraseña actual incorrecta' });
      return;
    }

    const newHash = hashPassword(password_nueva);
    await pool.query('UPDATE usuario SET password = ? WHERE id = ?', [newHash, userId]);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
