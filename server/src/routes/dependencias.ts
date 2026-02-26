import { Router, Request, Response } from 'express';
import { getPool, RowDataPacket } from '../db';
import { authMiddleware, requireRole } from '../middleware';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

// GET /api/dependencias
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM dependencia ORDER BY codigo'
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dependencias
router.post('/', requireRole('administrador', 'encargado'), async (req: Request, res: Response) => {
  try {
    const { codigo, dependencia } = req.body;
    const id = crypto.randomUUID();
    const pool = getPool();

    await pool.query(
      'INSERT INTO dependencia (id, codigo, dependencia) VALUES (?, ?, ?)',
      [id, codigo, dependencia]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM dependencia WHERE id = ?',
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/dependencias/:id
router.put('/:id', requireRole('administrador', 'encargado'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const pool = getPool();

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM dependencia WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: 'Dependencia no encontrada' });
      return;
    }

    const current = existing[0];
    const codigo = req.body.codigo ?? current.codigo;
    const dependencia = req.body.dependencia ?? current.dependencia;
    const activo = req.body.activo ?? current.activo;

    await pool.query(
      'UPDATE dependencia SET codigo = ?, dependencia = ?, activo = ? WHERE id = ?',
      [codigo, dependencia, activo, id]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM dependencia WHERE id = ?',
      [id]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
