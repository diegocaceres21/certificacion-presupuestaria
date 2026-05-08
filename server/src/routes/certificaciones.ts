import { Router, Request, Response } from 'express';
import { getPool, RowDataPacket, ResultSetHeader } from '../db';
import { authMiddleware, requireRole } from '../middleware';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

type DetalleInput = { id_cuenta_contable: string; monto: string | number };

function codigoSuffix(codigo: string): string {
  return codigo.length <= 3 ? codigo : codigo.slice(-3);
}

function parseMonto(value: string | number): number {
  const num = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num)) {
    throw new Error('Monto inválido');
  }
  return num;
}

async function resolveDetalles(
  pool: ReturnType<typeof getPool>,
  baseCuentaId: string,
  detallesInput: DetalleInput[] | undefined,
  montoTotal: string | number,
): Promise<DetalleInput[]> {
  const detalles = (detallesInput && detallesInput.length > 0)
    ? detallesInput
    : [{ id_cuenta_contable: baseCuentaId, monto: montoTotal }];

  if (!detalles.some((d) => d.id_cuenta_contable === baseCuentaId)) {
    throw new Error('La cuenta principal debe estar incluida en el detalle');
  }

  const ids = Array.from(new Set(detalles.map((d) => d.id_cuenta_contable)));
  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, codigo, nivel FROM cuenta_contable WHERE id IN (${placeholders})`,
    ids
  );

  const map = new Map<string, { codigo: string; nivel: number }>();
  for (const row of rows) {
    map.set(row.id, { codigo: row.codigo, nivel: row.nivel });
  }

  const base = map.get(baseCuentaId);
  if (!base) {
    throw new Error('Cuenta principal no encontrada');
  }

  const baseEs511 = base.codigo.startsWith('511') && base.nivel === 5;
  if (!baseEs511) {
    if (detalles.length !== 1 || detalles[0].id_cuenta_contable !== baseCuentaId) {
      throw new Error('Solo se permite una cuenta cuando la cuenta principal no es 511');
    }
  }

  const suffix = codigoSuffix(base.codigo);
  const seen = new Set<string>();
  let suma = 0;
  for (const det of detalles) {
    if (seen.has(det.id_cuenta_contable)) {
      throw new Error('No puede repetir la misma cuenta en el detalle');
    }
    seen.add(det.id_cuenta_contable);

    const cuenta = map.get(det.id_cuenta_contable);
    if (!cuenta) {
      throw new Error('Cuenta del detalle no encontrada');
    }
    if (baseEs511) {
      if (cuenta.nivel !== 5 || !cuenta.codigo.startsWith('511') || codigoSuffix(cuenta.codigo) !== suffix) {
        throw new Error('Las cuentas del detalle deben ser nivel 5, comenzar con 511 y tener la misma terminación');
      }
    }

    const monto = parseMonto(det.monto);
    if (monto <= 0) {
      throw new Error('El monto por cuenta debe ser mayor a 0');
    }
    suma += monto;
  }

  const total = parseMonto(montoTotal);
  if (Math.abs(suma - total) > 0.01) {
    throw new Error('La suma del detalle debe coincidir con el monto total');
  }

  return detalles;
}

async function replaceDetalles(
  pool: ReturnType<typeof getPool>,
  certId: string,
  detalles: DetalleInput[],
): Promise<void> {
  await pool.query('DELETE FROM certificacion_cuenta_detalle WHERE id_certificacion = ?', [certId]);
  for (const det of detalles) {
    await pool.query(
      `INSERT INTO certificacion_cuenta_detalle (id, id_certificacion, id_cuenta_contable, monto)
       VALUES (UUID(), ?, ?, ?)`,
      [certId, det.id_cuenta_contable, det.monto]
    );
  }
}

const DETALLE_SELECT = `
  SELECT
    c.id, c.nro_certificacion, c.anio_certificacion,
    c.fecha_certificacion, c.concepto, c.monto_total, c.comentario,
    uo.codigo as unidad_codigo, uo.unidad as unidad_nombre,
    cc.codigo as cuenta_codigo, cc.cuenta as cuenta_nombre,
    p.nombre as proyecto_nombre, p.descripcion as proyecto_descripcion, p.pei as proyecto_pei,
    c.generado_por as generado_por_id,
    pf.nombre_completo as generado_por_nombre, pf.cargo as generado_por_cargo,
    c.created_at, c.updated_at,
    COALESCE((SELECT COUNT(*) FROM certificacion_cuenta_detalle d WHERE d.id_certificacion = c.id), 1) as detalle_count
  FROM certificacion c
  INNER JOIN unidad_organizacional uo ON c.id_unidad = uo.id
  INNER JOIN cuenta_contable cc ON c.id_cuenta_contable = cc.id
  LEFT JOIN proyecto p ON c.id_proyecto = p.id
  INNER JOIN usuario u ON c.generado_por = u.id
  INNER JOIN perfil pf ON pf.id_usuario = u.id`;

async function obtenerCertificacionInternal(id: string) {
  const pool = getPool();

  const [rows]: any = await pool.query(
    `${DETALLE_SELECT} WHERE c.id = ? AND c.deleted_at IS NULL`,
    [id]
  );

  if (!rows.length) return null;

  const [detRows]: any = await pool.query(
    `SELECT d.id_cuenta_contable,
            cc.codigo as cuenta_codigo,
            cc.cuenta as cuenta_nombre,
            CAST(d.monto AS CHAR) as monto
     FROM certificacion_cuenta_detalle d
     INNER JOIN cuenta_contable cc 
       ON d.id_cuenta_contable = cc.id
     WHERE d.id_certificacion = ?
     ORDER BY cc.codigo`,
    [id]
  );
  console.log(detRows)

  return {
    ...JSON.parse(JSON.stringify(rows[0])),
    detalles: detRows ?? []
  };
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
      query += ' AND EXISTS (SELECT 1 FROM certificacion_cuenta_detalle d WHERE d.id_certificacion = c.id AND d.id_cuenta_contable = ?)';
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
    const { id_unidad, id_cuenta_contable, id_proyecto, concepto, monto_total, comentario, detalles } = req.body;
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

    let detallesFinal: DetalleInput[];
    try {
      detallesFinal = await resolveDetalles(
        pool,
        id_cuenta_contable,
        Array.isArray(detalles) ? detalles : undefined,
        monto_total
      );
    } catch (e: any) {
      res.status(400).json({ error: e.message });
      return;
    }

    await pool.query(
      `INSERT INTO certificacion (id, id_unidad, id_cuenta_contable, id_proyecto, generado_por, concepto, nro_certificacion, anio_certificacion, fecha_certificacion, monto_total, comentario)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, id_unidad, id_cuenta_contable, id_proyecto || null, userId, concepto, nro, anioActual, fecha, monto_total, comentario || null]
    );

    await replaceDetalles(pool, id, detallesFinal);

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

    let detallesFinal: DetalleInput[];
    try {
      detallesFinal = await resolveDetalles(
        pool,
        newCuenta,
        Array.isArray(req.body.detalles) ? req.body.detalles : undefined,
        newMonto
      );
    } catch (e: any) {
      res.status(400).json({ error: e.message });
      return;
    }

    await pool.query(
      'UPDATE certificacion SET id_unidad = ?, id_cuenta_contable = ?, id_proyecto = ?, concepto = ?, monto_total = ?, comentario = ? WHERE id = ?',
      [newUnidad, newCuenta, newProyecto, newConcepto, newMonto, newComentario, id]
    );

    await replaceDetalles(pool, id, detallesFinal);

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
