import { Router, Request, Response } from 'express';
import { getPool, RowDataPacket } from '../db';
import { authMiddleware, requireRole } from '../middleware';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

// GET /api/observaciones/:idCertificacion
router.get('/:idCertificacion', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        o.id, o.id_certificacion,
        pf.nombre_completo as creado_por_nombre,
        o.comentario, o.created_at
      FROM observacion_certificacion o
      INNER JOIN usuario u ON o.creado_por = u.id
      INNER JOIN perfil pf ON pf.id_usuario = u.id
      WHERE o.id_certificacion = ?
      ORDER BY o.created_at DESC`,
      [req.params.idCertificacion]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/observaciones
router.post('/', requireRole('administrador', 'encargado'), async (req: Request, res: Response) => {
  try {
    const { id_certificacion, comentario } = req.body;
    const userId = req.claims!.sub;
    const id = req.body.id || crypto.randomUUID();
    const pool = getPool();

    await pool.query(
      'INSERT INTO observacion_certificacion (id, id_certificacion, creado_por, comentario) VALUES (?, ?, ?, ?)',
      [id, id_certificacion, userId, comentario]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        o.id, o.id_certificacion,
        pf.nombre_completo as creado_por_nombre,
        o.comentario, o.created_at
      FROM observacion_certificacion o
      INNER JOIN usuario u ON o.creado_por = u.id
      INNER JOIN perfil pf ON pf.id_usuario = u.id
      WHERE o.id = ?`,
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
