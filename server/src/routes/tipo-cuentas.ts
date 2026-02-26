import { Router, Request, Response } from 'express';
import { getPool, RowDataPacket } from '../db';
import { authMiddleware, requireRole } from '../middleware';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

// GET /api/tipo-cuentas
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM tipo_cuenta ORDER BY tipo'
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tipo-cuentas
router.post('/', requireRole('administrador', 'encargado'), async (req: Request, res: Response) => {
  try {
    const { tipo } = req.body;
    const id = crypto.randomUUID();
    const pool = getPool();

    await pool.query(
      'INSERT INTO tipo_cuenta (id, tipo) VALUES (?, ?)',
      [id, tipo]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM tipo_cuenta WHERE id = ?',
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tipo-cuentas/:id
router.put('/:id', requireRole('administrador', 'encargado'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const pool = getPool();

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM tipo_cuenta WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: 'Tipo de cuenta no encontrado' });
      return;
    }

    const current = existing[0];
    const tipo = req.body.tipo ?? current.tipo;
    const activo = req.body.activo ?? current.activo;

    await pool.query(
      'UPDATE tipo_cuenta SET tipo = ?, activo = ? WHERE id = ?',
      [tipo, activo, id]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM tipo_cuenta WHERE id = ?',
      [id]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
