import { Router, Request, Response } from 'express';
import { getPool, RowDataPacket, ResultSetHeader } from '../db';
import { authMiddleware, requireRole } from '../middleware';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

const DETALLE_SELECT = `
  SELECT
    c.id, c.nro_certificacion, c.anio_certificacion,
    c.fecha_certificacion, c.concepto, c.monto_total, c.comentario,
    uo.codigo as unidad_codigo, uo.unidad as unidad_nombre,
    cc.codigo as cuenta_codigo, cc.cuenta as cuenta_nombre,
    p.nombre as proyecto_nombre, p.descripcion as proyecto_descripcion, p.pei as proyecto_pei,
    c.generado_por as generado_por_id,
    pf.nombre_completo as generado_por_nombre, pf.cargo as generado_por_cargo,
    c.created_at, c.updated_at
  FROM certificacion c
  INNER JOIN unidad_organizacional uo ON c.id_unidad = uo.id
  INNER JOIN cuenta_contable cc ON c.id_cuenta_contable = cc.id
  LEFT JOIN proyecto p ON c.id_proyecto = p.id
  INNER JOIN usuario u ON c.generado_por = u.id
  INNER JOIN perfil pf ON pf.id_usuario = u.id`;

async function obtenerCertificacionInternal(id: string): Promise<RowDataPacket | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `${DETALLE_SELECT} WHERE c.id = ? AND c.deleted_at IS NULL`,
    [id]
  );
  return rows[0] || null;
}

// GET /api/certificaciones
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    let query = `${DETALLE_SELECT} WHERE c.deleted_at IS NULL`;
    const params: string[] = [];

    if (req.query.id_unidad) {
      query += ' AND c.id_unidad = ?';
      params.push(req.query.id_unidad as string);
    }
    if (req.query.id_cuenta_contable) {
      query += ' AND c.id_cuenta_contable = ?';
      params.push(req.query.id_cuenta_contable as string);
    }
    if (req.query.id_proyecto) {
      query += ' AND c.id_proyecto = ?';
      params.push(req.query.id_proyecto as string);
    }
    if (req.query.generado_por) {
      query += ' AND c.generado_por = ?';
      params.push(req.query.generado_por as string);
    }
    if (req.query.fecha_desde) {
      query += ' AND c.fecha_certificacion >= ?';
      params.push(req.query.fecha_desde as string);
    }
    if (req.query.fecha_hasta) {
      query += ' AND c.fecha_certificacion <= ?';
      params.push(req.query.fecha_hasta as string);
    }
    if (req.query.busqueda) {
      query += ' AND (c.concepto LIKE ? OR CAST(c.nro_certificacion AS CHAR) LIKE ?)';
      const like = `%${req.query.busqueda}%`;
      params.push(like, like);
    }

    query += ' ORDER BY c.anio_certificacion DESC, c.nro_certificacion DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/certificaciones/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const cert = await obtenerCertificacionInternal(req.params.id as string);
    if (!cert) {
      res.status(404).json({ error: 'Certificación no encontrada' });
      return;
    }
    res.json(cert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/certificaciones
router.post('/', requireRole('administrador', 'encargado'), async (req: Request, res: Response) => {
  try {
    const { id_unidad, id_cuenta_contable, id_proyecto, concepto, monto_total, comentario } = req.body;
    const userId = req.claims!.sub;
    const pool = getPool();

    const anioActual = new Date().getFullYear();

    // Get next certification number
    const [maxRows] = await pool.query<RowDataPacket[]>(
      'SELECT MAX(nro_certificacion) as max_nro FROM certificacion WHERE anio_certificacion = ? AND deleted_at IS NULL',
      [anioActual]
    );
    const nro = (maxRows[0].max_nro || 0) + 1;
    const id = req.body.id || crypto.randomUUID();
    const fecha = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    await pool.query(
      `INSERT INTO certificacion (id, id_unidad, id_cuenta_contable, id_proyecto, generado_por, concepto, nro_certificacion, anio_certificacion, fecha_certificacion, monto_total, comentario)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, id_unidad, id_cuenta_contable, id_proyecto || null, userId, concepto, nro, anioActual, fecha, monto_total, comentario || null]
    );

    // If there's a comment, create observation
    if (comentario && comentario.trim()) {
      const obsId = crypto.randomUUID();
      await pool.query(
        'INSERT INTO observacion_certificacion (id, id_certificacion, creado_por, comentario) VALUES (?, ?, ?, ?)',
        [obsId, id, userId, comentario]
      );
    }

    const cert = await obtenerCertificacionInternal(id);
    res.status(201).json(cert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/certificaciones/:id
router.put('/:id', requireRole('administrador', 'encargado'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.claims!.sub;
    const pool = getPool();

    // Get current certification
    const [currentRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM certificacion WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (currentRows.length === 0) {
      res.status(404).json({ error: 'Certificación no encontrada' });
      return;
    }

    const current = currentRows[0];

    // Only creator or admin can edit
    if (current.generado_por !== userId && req.claims!.rol !== 'administrador') {
      res.status(403).json({ error: 'Solo el creador o un administrador puede editar esta certificación' });
      return;
    }

    // Create modification record
    const modId = crypto.randomUUID();
    const montoAntiguo = req.body.monto_total !== undefined ? current.monto_total : null;
    const conceptoAntiguo = req.body.concepto !== undefined ? current.concepto : null;

    await pool.query(
      `INSERT INTO modificacion (id, id_certificacion, modificado_por, monto_antiguo, monto_nuevo, concepto_antiguo, concepto_nuevo, fecha_hora, comentario)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        modId, id, userId,
        montoAntiguo,
        req.body.monto_total ?? null,
        conceptoAntiguo,
        req.body.concepto ?? null,
        req.body.comentario ?? null,
      ]
    );

    // Update certification
    const newConcepto = req.body.concepto ?? current.concepto;
    const newMonto = req.body.monto_total ?? current.monto_total;
    const newUnidad = req.body.id_unidad ?? current.id_unidad;
    const newCuenta = req.body.id_cuenta_contable ?? current.id_cuenta_contable;
    const newProyecto = req.body.id_proyecto !== undefined ? req.body.id_proyecto : current.id_proyecto;
    const newComentario = req.body.comentario !== undefined ? req.body.comentario : current.comentario;

    await pool.query(
      'UPDATE certificacion SET id_unidad = ?, id_cuenta_contable = ?, id_proyecto = ?, concepto = ?, monto_total = ?, comentario = ? WHERE id = ?',
      [newUnidad, newCuenta, newProyecto, newConcepto, newMonto, newComentario, id]
    );

    const cert = await obtenerCertificacionInternal(id as string);
    res.json(cert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/certificaciones/:id (soft delete)
router.delete('/:id', requireRole('administrador'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const pool = getPool();

    await pool.query(
      'UPDATE certificacion SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    res.json({ message: 'Certificación eliminada correctamente' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
