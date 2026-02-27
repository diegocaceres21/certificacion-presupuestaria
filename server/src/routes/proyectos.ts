import { Router, Request, Response } from 'express';
import { getPool, RowDataPacket } from '../db';
import { authMiddleware, requireRole } from '../middleware';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

// GET /api/proyectos
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM proyecto ORDER BY nombre'
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proyectos
router.post('/', requireRole('administrador', 'encargado'), async (req: Request, res: Response) => {
  try {
    const { nombre, descripcion, pei } = req.body;
    const id = req.body.id || crypto.randomUUID();
    const pool = getPool();

    await pool.query(
      `INSERT INTO proyecto (id, nombre, descripcion, pei) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), descripcion = VALUES(descripcion), pei = VALUES(pei)`,
      [id, nombre, descripcion || null, pei || null]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM proyecto WHERE id = ?',
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/proyectos/:id
router.put('/:id', requireRole('administrador', 'encargado'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const pool = getPool();

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM proyecto WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }

    const current = existing[0];
    await pool.query(
      'UPDATE proyecto SET nombre = ?, descripcion = ?, pei = ?, activo = ? WHERE id = ?',
      [
        req.body.nombre ?? current.nombre,
        req.body.descripcion !== undefined ? req.body.descripcion : current.descripcion,
        req.body.pei !== undefined ? req.body.pei : current.pei,
        req.body.activo ?? current.activo,
        id,
      ]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM proyecto WHERE id = ?',
      [id]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
