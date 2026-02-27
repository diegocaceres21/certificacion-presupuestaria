import { Router, Request, Response } from 'express';
import { getPool, RowDataPacket } from '../db';
import { authMiddleware, requireRole } from '../middleware';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

/**
 * Calculate account level from code length.
 * Length 1 → nivel 1, 2 → 2, 3 → 3, 5 → 4, 8 → 5
 */
function calcularNivel(codigo: string): number {
  const map: Record<number, number> = { 1: 1, 2: 2, 3: 3, 5: 4, 8: 5 };
  const nivel = map[codigo.length];
  if (!nivel) {
    throw new Error(
      `Longitud de código inválida (${codigo.length}). Longitudes válidas: 1 (nivel 1), 2 (nivel 2), 3 (nivel 3), 5 (nivel 4), 8 (nivel 5)`
    );
  }
  return nivel;
}

// GET /api/cuentas
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.id, c.id_tipo_cuenta, c.id_cuenta_padre, c.codigo, c.cuenta, c.nivel, c.activo,
              tc.tipo AS tipo_cuenta_nombre,
              cp.codigo AS cuenta_padre_codigo,
              cp.cuenta AS cuenta_padre_nombre
       FROM cuenta_contable c
       INNER JOIN tipo_cuenta tc ON tc.id = c.id_tipo_cuenta
       LEFT JOIN cuenta_contable cp ON cp.id = c.id_cuenta_padre
       ORDER BY c.codigo`
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cuentas
router.post('/', requireRole('administrador', 'encargado'), async (req: Request, res: Response) => {
  try {
    const { id_tipo_cuenta, id_cuenta_padre, codigo, cuenta } = req.body;
    const nivel = calcularNivel(codigo);
    const pool = getPool();

    // Validate parent hierarchy
    if (id_cuenta_padre) {
      const [parentRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM cuenta_contable WHERE id = ?',
        [id_cuenta_padre]
      );
      if (parentRows.length === 0) {
        res.status(400).json({ error: 'Cuenta padre no encontrada' });
        return;
      }
      if (parentRows[0].nivel >= nivel) {
        res.status(400).json({
          error: `La cuenta padre (nivel ${parentRows[0].nivel}) debe tener un nivel menor que la cuenta hija (nivel ${nivel})`,
        });
        return;
      }
    }

    const id = req.body.id || crypto.randomUUID();
    await pool.query(
      `INSERT INTO cuenta_contable (id, id_tipo_cuenta, id_cuenta_padre, codigo, cuenta, nivel) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id_tipo_cuenta = VALUES(id_tipo_cuenta), id_cuenta_padre = VALUES(id_cuenta_padre), codigo = VALUES(codigo), cuenta = VALUES(cuenta), nivel = VALUES(nivel)`,
      [id, id_tipo_cuenta, id_cuenta_padre || null, codigo, cuenta, nivel]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM cuenta_contable WHERE id = ?',
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/cuentas/:id
router.put('/:id', requireRole('administrador', 'encargado'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const pool = getPool();

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM cuenta_contable WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: 'Cuenta no encontrada' });
      return;
    }

    const current = existing[0];
    const newCodigo = req.body.codigo ?? current.codigo;
    const newNivel = calcularNivel(newCodigo);
    const newPadre = req.body.id_cuenta_padre !== undefined ? req.body.id_cuenta_padre : current.id_cuenta_padre;

    // Validate parent hierarchy
    if (newPadre) {
      const [parentRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM cuenta_contable WHERE id = ?',
        [newPadre]
      );
      if (parentRows.length === 0) {
        res.status(400).json({ error: 'Cuenta padre no encontrada' });
        return;
      }
      if (parentRows[0].nivel >= newNivel) {
        res.status(400).json({
          error: `La cuenta padre (nivel ${parentRows[0].nivel}) debe tener un nivel menor que la cuenta hija (nivel ${newNivel})`,
        });
        return;
      }
    }

    await pool.query(
      'UPDATE cuenta_contable SET id_tipo_cuenta = ?, id_cuenta_padre = ?, codigo = ?, cuenta = ?, nivel = ?, activo = ? WHERE id = ?',
      [
        req.body.id_tipo_cuenta ?? current.id_tipo_cuenta,
        newPadre,
        newCodigo,
        req.body.cuenta ?? current.cuenta,
        newNivel,
        req.body.activo ?? current.activo,
        id,
      ]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM cuenta_contable WHERE id = ?',
      [id]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
