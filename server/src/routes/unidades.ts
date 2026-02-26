import { Router, Request, Response } from 'express';
import { getPool, RowDataPacket } from '../db';
import { authMiddleware, requireRole } from '../middleware';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

// GET /api/unidades
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        uo.id, uo.id_dependencia, uo.codigo, uo.unidad, uo.activo,
        d.codigo as dependencia_codigo, d.dependencia as dependencia_nombre
      FROM unidad_organizacional uo
      INNER JOIN dependencia d ON uo.id_dependencia = d.id
      ORDER BY uo.codigo`
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/unidades
router.post('/', requireRole('administrador', 'encargado'), async (req: Request, res: Response) => {
  try {
    const { id_dependencia, codigo, unidad } = req.body;
    const id = crypto.randomUUID();
    const pool = getPool();

    await pool.query(
      'INSERT INTO unidad_organizacional (id, id_dependencia, codigo, unidad) VALUES (?, ?, ?, ?)',
      [id, id_dependencia, codigo, unidad]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        uo.id, uo.id_dependencia, uo.codigo, uo.unidad, uo.activo,
        d.codigo as dependencia_codigo, d.dependencia as dependencia_nombre
      FROM unidad_organizacional uo
      INNER JOIN dependencia d ON uo.id_dependencia = d.id
      WHERE uo.id = ?`,
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/unidades/:id
router.put('/:id', requireRole('administrador', 'encargado'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const pool = getPool();

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM unidad_organizacional WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: 'Unidad no encontrada' });
      return;
    }

    const current = existing[0];
    const id_dependencia = req.body.id_dependencia ?? current.id_dependencia;
    const codigo = req.body.codigo ?? current.codigo;
    const unidad = req.body.unidad ?? current.unidad;
    const activo = req.body.activo ?? current.activo;

    await pool.query(
      'UPDATE unidad_organizacional SET id_dependencia = ?, codigo = ?, unidad = ?, activo = ? WHERE id = ?',
      [id_dependencia, codigo, unidad, activo, id]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        uo.id, uo.id_dependencia, uo.codigo, uo.unidad, uo.activo,
        d.codigo as dependencia_codigo, d.dependencia as dependencia_nombre
      FROM unidad_organizacional uo
      INNER JOIN dependencia d ON uo.id_dependencia = d.id
      WHERE uo.id = ?`,
      [id]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
